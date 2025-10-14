import { HttpException, HttpStatus, Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { HttpService } from '@nestjs/axios';
import { lastValueFrom } from 'rxjs';
import { DependencyAnalyzerService } from './dependency-analyzer.service';
import { RepoHealth, RepoHealthDocument } from './repo-health.model';
import AdmZip from 'adm-zip';
import path from 'path';

interface GitHubRepoResponse {
  name: string;
  owner: { login: string };
  stargazers_count: number;
  forks_count: number;
  open_issues_count: number;
  pushed_at: string;
}

interface CommitActivityItem {
  week: number;
  total: number;
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

  /** 🌐 Analyze GitHub repo by owner/repo, optionally with package.json file or pasted JSON */
  async analyzeRepo(
    owner: string,
    repo: string,
    file?: Express.Multer.File,
    rawJson?: string | Record<string, any>,
    token?: string,
  ) {
    const headers: Record<string, string> = {
      Accept: 'application/vnd.github+json',
    };
    if (token) headers['Authorization'] = `Bearer ${token}`;
    const githubApiUrl = `https://api.github.com/repos/${owner}/${repo}`;
    let data: GitHubRepoResponse;

    try {
      const response = await lastValueFrom(
        this.httpService.get<GitHubRepoResponse>(githubApiUrl, { headers }),
      );
      data = response.data;
    } catch {
      throw new HttpException(
        'Failed to fetch repository data from GitHub',
        HttpStatus.BAD_GATEWAY,
      );
    }

    const commitActivity = await this.fetchCommitActivity(owner, repo, token);
    const securityAlerts = await this.fetchSecurityAlerts(owner, repo, token);

    const { dependencyHealth, riskyDependencies } =
      await this.processDependencies(file, rawJson);

    const overallHealth = this.calculateHealthScore(
      data,
      commitActivity,
      securityAlerts,
      dependencyHealth,
    );
    const repo_id = `${owner}/${repo}`;

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
        last_pushed: new Date(data.pushed_at),
        commit_activity: Array.isArray(commitActivity)
          ? (commitActivity as Array<{ total: number }>).map((c) =>
              typeof c.total === 'number' ? c.total : 0,
            )
          : [],
        security_alerts: Array.isArray(securityAlerts)
          ? securityAlerts.length
          : 0,
        dependency_health: dependencyHealth,
        risky_dependencies: riskyDependencies,
        overall_health: overallHealth,
      },
      { new: true, upsert: true, setDefaultsOnInsert: true },
    );

    return updated.toObject();
  }

  /** Public wrappers so other parts of the app can call these helpers if needed */
  async processDependencies(
    file?: Express.Multer.File,
    rawJson?: string | Record<string, any>,
  ): Promise<{ dependencyHealth: number; riskyDependencies: string[] }> {
    return this._processDependencies(file, rawJson);
  }

  async getCommitActivity(owner: string, repo: string, token?: string) {
    return this.fetchCommitActivity(owner, repo, token);
  }

  async getSecurityAlerts(owner: string, repo: string, token?: string) {
    return this.fetchSecurityAlerts(owner, repo, token);
  }

  calculateHealthScore(
    data: GitHubRepoResponse,
    commitActivity: { week: number; total: number }[],
    securityAlerts: any[],
    dependencyHealth: number,
  ) {
    return this._calculateHealthScore(
      data,
      commitActivity,
      securityAlerts,
      dependencyHealth,
    );
  }

  /** 🌐 Analyze by GitHub URL */
  async analyzeByUrl(
    url: string,
    file?: Express.Multer.File,
    rawJson?: string | Record<string, any>,
    token?: string,
  ) {
    const match = url.match(/github\.com\/([^/]+)\/([^/]+)/);
    if (!match) {
      throw new HttpException('Invalid GitHub URL', HttpStatus.BAD_REQUEST);
    }
    const [, owner, repo] = match;
    return this.analyzeRepo(owner, repo, file, rawJson, token);
  }

  /** 📦 Analyze pasted JSON directly */
  async analyzeJson(rawJson: string | Record<string, unknown>) {
    const parsed = this._parseJson(rawJson);
    const deps = this._extractDependencies(parsed) ?? {};
    const analysis = await this.dependencyAnalyzer.analyzeDependencies(deps);

    let projectName = 'unknown';
    if (
      typeof parsed === 'object' &&
      parsed !== null &&
      'name' in parsed &&
      typeof parsed.name === 'string'
    ) {
      projectName = (parsed as Record<string, string>).name;
    }

    const totalDependencies =
      typeof deps === 'object' && deps !== null ? Object.keys(deps).length : 0;

    return {
      project_name: projectName,
      total_dependencies: totalDependencies,
      dependency_health:
        typeof analysis?.score === 'number' ? analysis.score : 100,
      risky_dependencies: Array.isArray(analysis?.risky) ? analysis.risky : [],
      outdated_dependencies: Array.isArray(analysis?.outdated)
        ? analysis.outdated
        : [],
    };
  }

  /** Internal implementation of dependency processing */
  private async _processDependencies(
    file?: Express.Multer.File,
    rawJson?: string | Record<string, any>,
  ): Promise<{ dependencyHealth: number; riskyDependencies: string[] }> {
    let deps: Record<string, string> = {};

    try {
      if (rawJson) {
        deps = this._getDependenciesFromJson(rawJson);
      } else if (file) {
        deps = this._getDependenciesFromFile(file);
      }

      if (Object.keys(deps).length > 0) {
        const analysis =
          await this.dependencyAnalyzer.analyzeDependencies(deps);
        return {
          dependencyHealth: analysis?.score ?? 100,
          riskyDependencies: Array.isArray(analysis?.risky)
            ? analysis.risky
            : [],
        };
      }
    } catch (error) {
      if (error instanceof HttpException) throw error;
      throw new HttpException(
        'Failed to parse dependencies from the provided source.',
        HttpStatus.BAD_REQUEST,
      );
    }

    return { dependencyHealth: 100, riskyDependencies: [] };
  }

  /** Helper to get dependencies from a raw JSON string or object */
  private _getDependenciesFromJson(
    rawJson: string | Record<string, any>,
  ): Record<string, string> {
    const parsed = this._parseJson(rawJson);
    return this._extractDependencies(parsed);
  }

  /** Helper to get dependencies from an uploaded file (zip or package.json) */
  private _getDependenciesFromFile(
    file: Express.Multer.File,
  ): Record<string, string> {
    const isZip =
      file.mimetype === 'application/zip' || file.originalname.endsWith('.zip');

    if (isZip) {
      try {
        const zip = new AdmZip(file.buffer);
        const entries = zip.getEntries();

        const pkgEntry = Array.isArray(entries)
          ? entries.find(
              (e): e is import('adm-zip').IZipEntry =>
                typeof e === 'object' &&
                e !== null &&
                'entryName' in e &&
                typeof e.entryName === 'string' &&
                path.basename(e.entryName) === 'package.json' &&
                !e.isDirectory,
            )
          : undefined;

        if (pkgEntry && typeof pkgEntry.getData === 'function') {
          const buffer = pkgEntry.getData();
          if (!Buffer.isBuffer(buffer)) {
            throw new HttpException(
              'Failed to read package.json from zip: not a valid file.',
              HttpStatus.BAD_REQUEST,
            );
          }
          const content = buffer.toString('utf-8');
          return this._getDependenciesFromJson(content);
        }

        return {};
      } catch {
        throw new HttpException(
          'Failed to read or parse the zip file.',
          HttpStatus.BAD_REQUEST,
        );
      }
    }

    if (file.originalname.endsWith('package.json')) {
      const content = file.buffer.toString('utf-8');
      return this._getDependenciesFromJson(content);
    }

    throw new HttpException(
      'Unsupported file type. Please upload a package.json or a zip file.',
      HttpStatus.BAD_REQUEST,
    );
  }

  /** Helper to safely parse a JSON string or return an object */
  private _parseJson(
    rawJson: string | Record<string, unknown>,
  ): Record<string, unknown> {
    try {
      const parsed: unknown =
        typeof rawJson === 'string' ? JSON.parse(rawJson) : rawJson;

      if (
        typeof parsed !== 'object' ||
        parsed === null ||
        Array.isArray(parsed)
      ) {
        throw new Error('Invalid JSON structure');
      }

      return parsed as Record<string, unknown>;
    } catch {
      throw new HttpException(
        'Invalid JSON format. Must be a non-null object.',
        HttpStatus.BAD_REQUEST,
      );
    }
  }

  /** Helper to extract dependencies and devDependencies from a parsed package.json object */
  private _extractDependencies(
    packageJson: Record<string, unknown>,
  ): Record<string, string> {
    const deps: Record<string, string> = {};

    const addDeps = (source: unknown) => {
      if (typeof source === 'object' && source !== null) {
        for (const [key, value] of Object.entries(source)) {
          if (typeof value === 'string') {
            deps[key] = value;
          }
        }
      }
    };

    addDeps(packageJson.dependencies);
    addDeps(packageJson.devDependencies);

    return deps;
  }

  /** 📊 Fetch commit activity for the last 52 weeks */

  private async fetchCommitActivity(
    owner: string,
    repo: string,
    token?: string,
  ): Promise<CommitActivityItem[]> {
    try {
      const headers: Record<string, string> = {
        Accept: 'application/vnd.github+json',
      };
      if (token) headers['Authorization'] = `Bearer ${token}`;

      const url = `https://api.github.com/repos/${owner}/${repo}/stats/commit_activity`;
      const response = await lastValueFrom(
        this.httpService.get<unknown>(url, { headers }),
      );

      if (response.status === 202) {
        return [];
      }

      const data = response.data;
      if (!Array.isArray(data)) return [];

      return data.map((item) => {
        if (
          typeof item === 'object' &&
          item !== null &&
          typeof (item as Record<string, unknown>).week === 'number' &&
          typeof (item as Record<string, unknown>).total === 'number'
        ) {
          const obj = item as { week: number; total: number };
          return { week: obj.week, total: obj.total };
        }
        return { week: 0, total: 0 };
      });
    } catch {
      return [];
    }
  }

  /** 🛡 Fetch security vulnerability alerts */
  private async fetchSecurityAlerts(
    owner: string,
    repo: string,
    token?: string,
  ) {
    try {
      const headers: Record<string, string> = {
        Accept: 'application/vnd.github.v3+json',
      };
      if (token) headers['Authorization'] = `Bearer ${token}`;
      const url = `https://api.github.com/repos/${owner}/${repo}/vulnerability-alerts`;
      const response = await lastValueFrom(
        this.httpService.get(url, { headers }),
      );

      if (response.status === 204) return [true];
      if (response.status === 404) return [];

      return [];
    } catch {
      return [];
    }
  }

  /** ⚖️ Calculate a weighted, holistic repo health score */
  private _calculateHealthScore(
    repo: GitHubRepoResponse,
    commitActivity: { week: number; total: number }[],
    securityAlerts: any[],
    dependencyHealth: number,
  ) {
    const WEIGHTS = {
      STARS: 0.2,
      FORKS: 0.15,
      RECENCY: 0.15,
      COMMITS: 0.2,
      DEPENDENCIES: 0.15,
      ISSUES: 0.1,
      SECURITY: 0.05,
    } as const;

    const starsScore = Math.min((repo.stargazers_count ?? 0) / 5000, 1);
    const forksScore = Math.min((repo.forks_count ?? 0) / 1000, 1);

    const daysSinceLastPush =
      (Date.now() - new Date(repo.pushed_at).getTime()) / (1000 * 60 * 60 * 24);
    const recencyScore = Math.max(0, 1 - daysSinceLastPush / 365);

    const recentCommits = Array.isArray(commitActivity)
      ? commitActivity.slice(-12)
      : [];
    const totalRecentCommits = recentCommits.reduce(
      (sum, week) => sum + (week.total ?? 0),
      0,
    );
    const commitScore = Math.min(totalRecentCommits / 100, 1);
    const dependencyScore = Math.min(Math.max(dependencyHealth / 100, 0), 1);

    const issuePenalty = Math.max(
      0,
      1 -
        ((repo.open_issues_count ?? 0) / ((repo.stargazers_count ?? 0) + 1)) *
          0.5,
    );
    const securityPenalty =
      securityAlerts && securityAlerts.length > 0 ? 0.5 : 1;

    const score =
      (starsScore * WEIGHTS.STARS +
        forksScore * WEIGHTS.FORKS +
        recencyScore * WEIGHTS.RECENCY +
        commitScore * WEIGHTS.COMMITS +
        dependencyScore * WEIGHTS.DEPENDENCIES +
        issuePenalty * WEIGHTS.ISSUES +
        securityPenalty * WEIGHTS.SECURITY) *
      100;

    return Math.round(Math.max(0, Math.min(score, 100)));
  }
}
