// repo-health.service.ts
import { HttpException, HttpStatus, Injectable, Logger } from '@nestjs/common';
import { GithubApiService } from './github-api.service';
import { DependencyAnalysisService } from './dependency-analysis.service';
import { HealthCalculatorService } from './health-calculator.service';
import { RepositoryDataService } from './repository-data.service';
import { RepoHealthDocument } from '../repo-health.model';
import {
  GitHubRepoResponse,
  CommitActivityItem,
  SecurityAlert,
  DependencyAnalysisResult,
  RepositoryHealthData,
  RepositoryNotFoundException,
  PrivateRepositoryException,
  InvalidTokenException,
} from '../repo-health.interface';

@Injectable()
export class RepoHealthService {
  private readonly logger = new Logger(RepoHealthService.name);

  constructor(
    private readonly githubApiService: GithubApiService,
    private readonly dependencyAnalysisService: DependencyAnalysisService,
    private readonly healthCalculatorService: HealthCalculatorService,
    private readonly repositoryDataService: RepositoryDataService,
  ) {}


  async analyzePublicRepository(
    owner: string,
    repo: string,
    file?: Express.Multer.File,
    rawJson?: string | Record<string, unknown>,
  ): Promise<RepoHealthDocument> {
    try {
      const [repoData, commitActivity, securityAlerts, dependencyAnalysis] =
        await Promise.all([
          this.githubApiService.fetchPublicRepositoryData(owner, repo),
          this.githubApiService.fetchPublicCommitActivity(owner, repo),
          this.githubApiService.fetchPublicSecurityAlerts(owner, repo),
          this.dependencyAnalysisService.analyzeDependencies(file, rawJson),
        ]);

      return await this.computeAndUpsertHealth(
        owner,
        repo,
        repoData,
        commitActivity,
        securityAlerts,
        dependencyAnalysis,
      );
    } catch (error) {
      this.logger.error(
        `Public repository analysis failed for ${owner}/${repo}:`,
        error,
      );

      if (error instanceof HttpException) {
        throw error;
      }

      throw new HttpException(
        `Analysis failed for repository ${owner}/${repo}`,
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  async analyzePrivateRepository(
    owner: string,
    repo: string,
    token: string,
    file?: Express.Multer.File,
    rawJson?: string | Record<string, unknown>,
  ): Promise<RepoHealthDocument> {
    try {
      // Verify it's actually private
      const visibility = await this.githubApiService.determineRepoVisibility(
        owner,
        repo,
        token,
      );
      if (visibility !== 'private') {
        throw new HttpException(
          `Repository '${owner}/${repo}' is not private. Use public analysis method.`,
          HttpStatus.BAD_REQUEST,
        );
      }

      const [repoData, commitActivity, securityAlerts, dependencyAnalysis] =
        await Promise.all([
          this.githubApiService.fetchPrivateRepositoryData(owner, repo, token),
          this.githubApiService.fetchPrivateCommitActivity(owner, repo, token),
          this.githubApiService.fetchPrivateSecurityAlerts(owner, repo, token),
          this.dependencyAnalysisService.analyzeDependencies(file, rawJson),
        ]);

      return await this.computeAndUpsertHealth(
        owner,
        repo,
        repoData,
        commitActivity,
        securityAlerts,
        dependencyAnalysis,
      );
    } catch (error) {
      this.logger.error(
        `Private repository analysis failed for ${owner}/${repo}:`,
        error,
      );

      if (error instanceof HttpException) {
        throw error;
      }

      throw new HttpException(
        `Private repository analysis failed for ${owner}/${repo}`,
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  async analyzeRepositoryAuto(
    owner: string,
    repo: string,
    file?: Express.Multer.File,
    rawJson?: string | Record<string, unknown>,
    token?: string,
  ): Promise<RepoHealthDocument> {
    const visibility = await this.githubApiService.determineRepoVisibility(
      owner,
      repo,
      token,
    );

    if (visibility === 'private') {
      if (!token) {
        throw new PrivateRepositoryException(owner, repo);
      }
      return this.analyzePrivateRepository(owner, repo, token, file, rawJson);
    }

    // Public repository - ignore token even if provided for consistency
    return this.analyzePublicRepository(owner, repo, file, rawJson);
  }

  // ==================== URL-BASED METHODS ====================

  async analyzePublicRepoByUrl(
    url: string,
    file?: Express.Multer.File,
    rawJson?: string | Record<string, unknown>,
  ): Promise<RepoHealthDocument> {
    const { owner, repo } = this.parseGitHubUrl(url);
    return this.analyzePublicRepository(owner, repo, file, rawJson);
  }

  async analyzePrivateRepoByUrl(
    url: string,
    token: string,
    file?: Express.Multer.File,
    rawJson?: string | Record<string, unknown>,
  ): Promise<RepoHealthDocument> {
    const { owner, repo } = this.parseGitHubUrl(url);
    return this.analyzePrivateRepository(owner, repo, token, file, rawJson);
  }

  async analyzeByUrlAuto(
    url: string,
    file?: Express.Multer.File,
    rawJson?: string | Record<string, unknown>,
    token?: string,
  ): Promise<RepoHealthDocument> {
    const { owner, repo } = this.parseGitHubUrl(url);
    return this.analyzeRepositoryAuto(owner, repo, file, rawJson, token);
  }

  // ==================== SIMPLIFIED CONTROLLER METHODS ====================

  async analyzeByUrl(url: string): Promise<RepoHealthDocument> {
    const { owner, repo } = this.parseGitHubUrl(url);

    // Auto-detect and handle accordingly
    const visibility = await this.githubApiService.determineRepoVisibility(
      owner,
      repo,
    );

    if (visibility === 'private') {
      throw new PrivateRepositoryException(owner, repo);
    }

    return this.analyzePublicRepository(owner, repo);
  }

  async analyzePrivateByUrl(
    url: string,
    token: string,
  ): Promise<RepoHealthDocument> {
    const { owner, repo } = this.parseGitHubUrl(url);
    return this.analyzePrivateRepository(owner, repo, token);
  }

  // ==================== DATA ACCESS METHODS ====================

  async findRepoHealth(
    owner: string,
    repo: string,
  ): Promise<RepoHealthDocument> {
    try {
      const record = await this.repositoryDataService.findOne(
        `${owner}/${repo}`,
      );

      if (!record) {
        throw new RepositoryNotFoundException(owner, repo);
      }

      return record;
    } catch (error) {
      if (error instanceof HttpException) throw error;

      throw new HttpException(
        'Failed to retrieve repository health',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  async findOne(repo_id: string): Promise<RepoHealthDocument | null> {
    return this.repositoryDataService.findOne(repo_id);
  }

  async findAll(page?: number, limit?: number, sort?: string) {
    return this.repositoryDataService.findAll(page, limit, sort);
  }

  async findByOwner(owner: string): Promise<RepoHealthDocument[]> {
    return this.repositoryDataService.findByOwner(owner);
  }

  async getStats() {
    return this.repositoryDataService.getStats();
  }

  async checkRepoVisibility(
    url: string,
    token?: string,
  ): Promise<{ visibility: 'public' | 'private' }> {
    const { owner, repo } = this.parseGitHubUrl(url);
    const visibility = await this.githubApiService.determineRepoVisibility(
      owner,
      repo,
      token,
    );
    return { visibility };
  }

  // ==================== BATCH OPERATIONS ====================

  async analyzeMultipleRepositories(
    requests: Array<{
      url: string;
      token?: string;
      file?: Express.Multer.File;
      rawJson?: string | Record<string, unknown>;
    }>,
    concurrency = 2,
  ): Promise<
    Array<{ url: string; data?: RepoHealthDocument; error?: string }>
  > {
    const results: Array<{
      url: string;
      data?: RepoHealthDocument;
      error?: string;
    }> = [];

    for (let i = 0; i < requests.length; i += concurrency) {
      const batch = requests.slice(i, i + concurrency);

      const batchResults = await Promise.allSettled(
        batch.map(async ({ url, token, file, rawJson }) => {
          try {
            const data = await this.analyzeByUrlAuto(url, file, rawJson, token);
            return { url, data };
          } catch (error: any) {
            return { url, error: error.message };
          }
        }),
      );

      batchResults.forEach((result) => {
        if (result.status === 'fulfilled') {
          results.push(result.value);
        }
      });

      // Rate limit protection between batches
      if (i + concurrency < requests.length) {
        await new Promise((resolve) => setTimeout(resolve, 2000));
      }
    }

    return results;
  }

  private async computeAndUpsertHealth(
    owner: string,
    repo: string,
    repoData: GitHubRepoResponse,
    commitActivity: CommitActivityItem[],
    securityAlerts: SecurityAlert[],
    dependencyAnalysis: DependencyAnalysisResult,
  ): Promise<RepoHealthDocument> {
    const overallHealth = this.healthCalculatorService.calculateHealthScore(
      repoData,
      commitActivity,
      securityAlerts,
      dependencyAnalysis.dependencyHealth,
    );

    const repo_id = `${owner}/${repo}`;
    const updateData: RepositoryHealthData = {
      repo_id,
      owner,
      repo,
      name: repoData.name,
      stars: repoData.stargazers_count,
      forks: repoData.forks_count,
      open_issues: repoData.open_issues_count,
      last_pushed: new Date(repoData.pushed_at),
      commit_activity: commitActivity.map((c) => c.total),
      security_alerts: securityAlerts.length,
      dependency_health: (typeof dependencyAnalysis.dependencyHealth === 'object' && dependencyAnalysis.dependencyHealth !== null && 'score' in dependencyAnalysis.dependencyHealth)
        ? (dependencyAnalysis.dependencyHealth as { score: number }).score
        : (typeof dependencyAnalysis.dependencyHealth === 'number'
          ? dependencyAnalysis.dependencyHealth
          : 0),
      risky_dependencies: dependencyAnalysis.riskyDependencies,
      overall_health: overallHealth,
      bundle_size: dependencyAnalysis.bundleSize,
      license_risks: dependencyAnalysis.licenseRisks,
      popularity: dependencyAnalysis.popularity,
      days_behind: dependencyAnalysis.daysBehind,
    };

    return this.repositoryDataService.upsertRepoHealth(repo_id, updateData);
  }

  private parseGitHubUrl(url: string): { owner: string; repo: string } {
    if (!url || typeof url !== 'string') {
      throw new HttpException('URL is required', HttpStatus.BAD_REQUEST);
    }

    const trimmedUrl = url
      .trim()
      .replace(/\.git$/, '')
      .replace(/\/$/, '');

    const patterns = [
      /github\.com[:/](?<owner>[^/]+)\/(?<repo>[^/#?]+)(?:$|\/|#|\?)/,
      /git@github\.com:(?<owner>[^/]+)\/(?<repo>[^/.]+)(?:\.git)?$/,
      /^https?:\/\/api\.github\.com\/repos\/(?<owner>[^/]+)\/(?<repo>[^/]+)/,
    ];

    for (const pattern of patterns) {
      const match = trimmedUrl.match(pattern);
      if (match?.groups) {
        return {
          owner: match.groups.owner,
          repo: match.groups.repo,
        };
      }
    }

    throw new HttpException(
      'Invalid GitHub repository URL. Expected format: https://github.com/owner/repo or owner/repo',
      HttpStatus.BAD_REQUEST,
    );
  }

  // ==================== UTILITY METHODS ====================

  async processDependencies(
    file?: Express.Multer.File,
    rawJson?: string | Record<string, unknown>,
  ) {
    return this.dependencyAnalysisService.analyzeDependencies(file, rawJson);
  }

  calculateHealthScore(
    repoData: any,
    commitActivity: any[],
    securityAlerts: any[],
    dependencyHealth: number,
  ) {
    return this.healthCalculatorService.calculateHealthScore(
      repoData,
      commitActivity,
      securityAlerts,
      dependencyHealth,
    );
  }

  // Cache management
  async clearCache(): Promise<void> {
    // If you're using a more sophisticated cache, implement clearing logic here
    this.logger.log(
      'Cache clear requested - implement if using external cache',
    );
  }
}
