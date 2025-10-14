import { Injectable, HttpException, HttpStatus } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { HttpService } from '@nestjs/axios';
import { lastValueFrom } from 'rxjs';
import { DependencyAnalyzerService } from './dependency-analyzer.service';
import { RepoHealth, RepoHealthDocument } from './repo-health.model';

interface GitHubRepoResponse {
  name: string;
  owner: { login: string };
  stargazers_count: number;
  forks_count: number;
  open_issues_count: number;
  pushed_at: string;
}

@Injectable()
export class RepoHealthService {
  constructor(
    @InjectModel(RepoHealth.name)
    private readonly repoHealthModel: Model<RepoHealthDocument>,
    private readonly httpService: HttpService,
    private readonly dependencyAnalyzer: DependencyAnalyzerService,
  ) {}

  /** 🔍 Fetch stored repo health info from MongoDB */
  async findRepoHealth(owner: string, repo: string) {
    const record = await this.repoHealthModel.findOne({ owner, repo }).exec();
    if (!record) {
      throw new HttpException(
        `No analysis found for ${owner}/${repo}`,
        HttpStatus.NOT_FOUND,
      );
    }
    return record.toObject();
  }

  /** 🌐 Analyze repository from GitHub + optional package.json (file or pasted JSON) */
  async analyzeRepo(
    owner: string,
    repo: string,
    file?: Express.Multer.File,
    rawJson?: string,
    token?: string, // optional GitHub token
  ) {
    // 1️⃣ Fetch GitHub repo data
    const githubApiUrl = `https://api.github.com/repos/${owner}/${repo}`;
    const response = await lastValueFrom(
      this.httpService.get<GitHubRepoResponse>(githubApiUrl),
    );
    const data = response.data;

    if (!data) {
      throw new HttpException(
        'Failed to fetch repository data from GitHub.',
        HttpStatus.BAD_GATEWAY,
      );
    }

    // 2️⃣ Fetch commit activity & security alerts (pass token here)
    const commitActivity = await this.fetchCommitActivity(owner, repo);
    const securityAlerts = await this.fetchSecurityAlerts(owner, repo, token);

    // 3️⃣ Analyze dependencies if package.json is provided
    let dependencyHealth = 100;
    let riskyDependencies: string[] = [];
    if (file || rawJson) {
      const jsonContent = file ? file.buffer.toString('utf-8') : rawJson;
      if (jsonContent) {
        try {
          const parsed = JSON.parse(jsonContent) as {
            dependencies?: Record<string, string>;
            devDependencies?: Record<string, string>;
          };
          const deps = {
            ...(parsed.dependencies ?? {}),
            ...(parsed.devDependencies ?? {}),
          };
          const analysis =
            await this.dependencyAnalyzer.analyzeDependencies(deps);
          dependencyHealth = analysis.score;
          riskyDependencies = analysis.risky;
        } catch {
          // ignore invalid JSON
        }
      }
    }

    // 4️⃣ Calculate overall health score
    const overallHealth = this.calculateHealthScore(
      data,
      commitActivity,
      securityAlerts,
      dependencyHealth,
    );

    const repo_id = `${owner}/${repo}`;

    // 5️⃣ Save/update analysis in MongoDB
    const updated = await this.repoHealthModel.findOneAndUpdate(
      { repo_id },
      {
        repo_id,
        owner,
        repo,
        name: data.name,
        stars: data.stargazers_count,
        forks: data.forks_count,
        open_issues: data.open_issues_count,
        last_pushed: data.pushed_at,
        commit_activity: commitActivity.map((c) => c.total),
        security_alerts: securityAlerts.length,
        dependency_health: dependencyHealth,
        risky_dependencies: riskyDependencies,
        overall_health: overallHealth,
      },
      { new: true, upsert: true, setDefaultsOnInsert: true },
    );

    return updated.toObject();
  }

  /** 🌐 Analyze repository by full GitHub URL */
  async analyzeByUrl(
    url: string,
    file?: Express.Multer.File,
    rawJson?: string,
    token?: string,
  ) {
    const match = url.match(/github\.com\/([^/]+)\/([^/]+)(?:\.git|\/)?/);

    if (!match) {
      throw new HttpException(
        'Invalid GitHub URL provided.',
        HttpStatus.BAD_REQUEST,
      );
    }
    const [, owner, repo] = match;
    return this.analyzeRepo(owner, repo, file, rawJson, token);
  }

  /** 📊 Fetch commit activity (last 52 weeks) */
  private async fetchCommitActivity(
    owner: string,
    repo: string,
  ): Promise<{ week: number; total: number }[]> {
    try {
      const url = `https://api.github.com/repos/${owner}/${repo}/stats/commit_activity`;
      const response = await lastValueFrom(this.httpService.get(url));
      if (Array.isArray(response.data)) {
        return response.data.map((item: unknown) => {
          if (
            item &&
            typeof item === 'object' &&
            'week' in item &&
            'total' in item
          ) {
            const typedItem = item as { week?: unknown; total?: unknown };
            return {
              week: typeof typedItem.week === 'number' ? typedItem.week : 0,
              total: typeof typedItem.total === 'number' ? typedItem.total : 0,
            };
          }
          return { week: 0, total: 0 };
        });
      }
      return [];
    } catch {
      return [];
    }
  }

  /** 🛡 Fetch security vulnerability alerts */
  private async fetchSecurityAlerts(
    owner: string,
    repo: string,
    token?: string, // optional user token
  ): Promise<any[]> {
    try {
      const url = `https://api.github.com/repos/${owner}/${repo}/vulnerability-alerts`;
      const headers: Record<string, string> = {
        Accept:
          'application/vnd.github+json, application/vnd.github+vuln-preview+json',
      };

      // Use user-provided token if available, otherwise fallback to server token
      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
      } else if (process.env.GITHUB_TOKEN) {
        headers['Authorization'] = `Bearer ${process.env.GITHUB_TOKEN}`;
      }

      const response = await lastValueFrom(
        this.httpService.get(url, { headers }),
      );
      return Array.isArray(response.data) ? response.data : [];
    } catch {
      return [];
    }
  }

  /** ⚖️ Weighted holistic repo health calculation */
  private calculateHealthScore(
    repo: GitHubRepoResponse,
    commitActivity: { week: number; total: number }[],
    securityAlerts: any[],
    dependencyHealth: number,
  ): number {
    const starsWeight = Math.min(repo.stargazers_count / 5000, 1) * 0.25;
    const forksWeight = Math.min(repo.forks_count / 1000, 1) * 0.2;
    const issuePenalty = repo.open_issues_count > 100 ? 0.7 : 1;

    const daysSinceLastPush =
      (Date.now() - new Date(repo.pushed_at).getTime()) / (1000 * 60 * 60 * 24);
    const recencyWeight = daysSinceLastPush < 90 ? 1 : 0.5;

    const recentCommits = commitActivity.slice(-4);
    const commitAvg =
      recentCommits.length > 0
        ? recentCommits.reduce((sum, w) => sum + w.total, 0) /
          recentCommits.length
        : 0;
    const commitHealth = Math.min(commitAvg / 50, 1) * 0.25;

    const securityPenalty = securityAlerts.length > 0 ? 0.8 : 1;
    const dependencyWeight = Math.min(dependencyHealth / 100, 1) * 0.2;

    const score =
      (starsWeight +
        forksWeight +
        commitHealth +
        dependencyWeight +
        recencyWeight * issuePenalty * securityPenalty) *
      100;

    return Math.round(Math.max(Math.min(score, 100), 0));
  }

  /** 📦 Analyze raw package.json separately */
  async analyzePackageJson(file?: Express.Multer.File, rawJson?: string) {
    if (!file && !rawJson) {
      throw new HttpException(
        'No package.json content provided.',
        HttpStatus.BAD_REQUEST,
      );
    }

    const jsonContent = file ? file.buffer.toString('utf-8') : rawJson!;
    let parsed: {
      name?: string;
      dependencies?: Record<string, string>;
      devDependencies?: Record<string, string>;
    };

    try {
      parsed = JSON.parse(jsonContent) as {
        name?: string;
        dependencies?: Record<string, string>;
        devDependencies?: Record<string, string>;
      };
    } catch {
      throw new HttpException('Invalid JSON format.', HttpStatus.BAD_REQUEST);
    }

    const deps = {
      ...(parsed.dependencies ?? {}),
      ...(parsed.devDependencies ?? {}),
    };
    const analysis = await this.dependencyAnalyzer.analyzeDependencies(deps);

    return {
      project_name: parsed.name ?? 'unknown',
      total_dependencies: Object.keys(deps).length,
      dependency_health: analysis.score,
      risky_dependencies: analysis.risky,
      outdated_dependencies: analysis.outdated,
      overall_health: analysis.score,
    };
  }
}
