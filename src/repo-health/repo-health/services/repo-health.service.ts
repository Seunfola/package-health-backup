import { HttpException, HttpStatus, Injectable, Logger } from '@nestjs/common';
import { GithubApiService } from './github-api.service';
import { DependencyAnalysisService } from './dependency-analysis.service';
import { HealthCalculatorService } from './health-calculator.service';
import { RepositoryDataService } from './repository-data.service';
import { RepoHealthDocument } from '../repo-health.model';

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
    token?: string,
  ): Promise<RepoHealthDocument> {
    const [repoData, commitActivity, securityAlerts, dependencyAnalysis] =
      await Promise.all([
        this.githubApiService.fetchRepositoryData(owner, repo, token),
        this.githubApiService.fetchCommitActivity(owner, repo, token),
        this.githubApiService.fetchSecurityAlerts(owner, repo, token),
        this.dependencyAnalysisService.analyzeDependencies(file, rawJson),
      ]);

    const overallHealth = this.healthCalculatorService.calculateHealthScore(
      repoData,
      commitActivity,
      securityAlerts,
      dependencyAnalysis.dependencyHealth,
    );

    const repo_id = `${owner}/${repo}`;
    const updateData = {
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
      dependency_health: dependencyAnalysis.dependencyHealth,
      risky_dependencies: dependencyAnalysis.riskyDependencies,
      overall_health: overallHealth,
      bundle_size: dependencyAnalysis.bundleSize,
      license_risks: dependencyAnalysis.licenseRisks,
      popularity: dependencyAnalysis.popularity,
      days_behind: dependencyAnalysis.daysBehind,
    };

    return this.repositoryDataService.upsertRepoHealth(repo_id, updateData);
  }

  async analyzePrivateRepository(
    owner: string,
    repo: string,
    token: string,
    file?: Express.Multer.File,
    rawJson?: string | Record<string, unknown>,
  ): Promise<RepoHealthDocument> {
    // Verify it's actually private
    const visibility = await this.githubApiService.determineRepoVisibility(
      owner,
      repo,
    );
    if (visibility !== 'private') {
      throw new HttpException(
        `Repository '${owner}/${repo}' is not private. Use public analysis method.`,
        HttpStatus.BAD_REQUEST,
      );
    }

    return this.analyzePublicRepository(owner, repo, file, rawJson, token);
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
    );

    if (visibility === 'private' && !token) {
      throw new HttpException(
        `Repository '${owner}/${repo}' is private and requires a GitHub token.`,
        HttpStatus.BAD_REQUEST,
      );
    }

    return this.analyzePublicRepository(owner, repo, file, rawJson, token);
  }

  async analyzePublicRepoByUrl(
    url: string,
    file?: Express.Multer.File,
    rawJson?: string | Record<string, unknown>,
    token?: string,
  ): Promise<RepoHealthDocument> {
    const { owner, repo } = this.parseGitHubUrl(url);
    return this.analyzePublicRepository(owner, repo, file, rawJson, token);
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

  async analyzeRepo(
    owner: string,
    repo: string,
    file?: Express.Multer.File,
    rawJson?: string | Record<string, unknown>,
    token?: string,
  ): Promise<RepoHealthDocument> {
    return this.analyzeRepositoryAuto(owner, repo, file, rawJson, token);
  }

  async analyzeByUrl(
    url: string,
    file?: Express.Multer.File,
    rawJson?: string | Record<string, unknown>,
    token?: string,
  ): Promise<RepoHealthDocument> {
    return this.analyzeByUrlAuto(url, file, rawJson, token);
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
    );
    return { visibility };
  }

  // ==================== UTILITY METHODS ====================

  private parseGitHubUrl(url: string): { owner: string; repo: string } {
    url = url
      .trim()
      .replace(/\.git$/, '')
      .replace(/\/$/, '');

    const match =
      url.match(/github\.com[:/](?<owner>[^/]+)\/(?<repo>[^/]+)(?:$|\/)/) ??
      url.match(/git@github\.com:(?<owner>[^/]+)\/(?<repo>[^/]+)/);

    if (!match?.groups) {
      throw new HttpException(
        'Invalid GitHub repository URL',
        HttpStatus.BAD_REQUEST,
      );
    }

    return match.groups as { owner: string; repo: string };
  }

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
}
