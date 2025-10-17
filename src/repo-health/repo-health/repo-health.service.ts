import { HttpException, HttpStatus, Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { HttpService } from '@nestjs/axios';
import { lastValueFrom } from 'rxjs';
import { DependencyAnalyzerService } from './dependency-analyzer.service';
import { RepoHealth, RepoHealthDocument } from './repo-health.model';
import AdmZip from 'adm-zip';
import path from 'path';
import fs from 'fs';

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

type CacheEntry<T> = { createdAt: number; ttlMs: number; value: T };

class Semaphore {
  private queue: Array<() => void> = [];
  private counter: number = 0;
  constructor(private readonly max: number) {}
  async acquire(): Promise<() => void> {
    if (this.counter < this.max) {
      this.counter++;
      return () => {
        this.counter--;
        const next = this.queue.shift();
        if (next) next();
      };
    }
    return new Promise<() => void>((resolve) => {
      this.queue.push(() => {
        this.counter++;
        resolve(() => {
          this.counter--;
          const next = this.queue.shift();
          if (next) next();
        });
      });
    });
  }
}

@Injectable()
export class RepoHealthService {
  private readonly analysisSemaphore = new Semaphore(4);

  private readonly cache = new Map<string, CacheEntry<unknown>>();

  private readonly dockerAvailable: boolean;

  constructor(
    @InjectModel(RepoHealth.name)
    private readonly repoHealthModel: Model<RepoHealthDocument>,
    private readonly httpService: HttpService,
    private readonly dependencyAnalyzer: DependencyAnalyzerService,
  ) {
    this.dockerAvailable = this.detectDocker();
  }

  private detectDocker(): boolean {
    try {
      return fs.existsSync('/var/run/docker.sock');
    } catch {
      return false;
    }
  }

  async findOne(
    owner: string,
    repo: string,
  ): Promise<RepoHealthDocument | null> {
    try {
      const record = await this.repoHealthModel.findOne({ owner, repo }).exec();
      return record;
    } catch {
      throw new HttpException(
        'Failed to find repository',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  async findMany(query: {
    owner?: string;
    repo?: string;
    minHealthScore?: number;
    limit?: number;
    offset?: number;
  }): Promise<RepoHealthDocument[]> {
    try {
      const { owner, repo, minHealthScore, limit = 50, offset = 0 } = query;

      const mongoQuery: Record<string, unknown> = {};

      if (owner) {
        mongoQuery['owner'] = owner;
      }

      if (repo) {
        mongoQuery['repo'] = repo;
      }

      if (minHealthScore !== undefined) {
        mongoQuery['overall_health.score'] = { $gte: minHealthScore };
      }

      const records = await this.repoHealthModel
        .find(mongoQuery)
        .skip(offset)
        .limit(limit)
        .exec();

      return records;
    } catch {
      throw new HttpException(
        'Failed to find repositories',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  async findAll(): Promise<RepoHealthDocument[]> {
    try {
      return await this.repoHealthModel.find().exec();
    } catch {
      throw new HttpException(
        'Failed to retrieve all repositories',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  async getAllRepoStatuses(): Promise<any[]> {
    try {
      const repos = await this.repoHealthModel.find().lean().exec();
      return repos.map((repo) => ({
        ...repo,
        vulnerabilities: Array.from(
          { length: repo.security_alerts || 0 },
          (_, i) => ({
            packageName: `vulnerability-${i}`,
            severity: 'high',
            detectedAt: new Date(),
          }),
        ),
        outdatedDependencies: (repo.risky_dependencies || []).map((name) => ({
          name,
          latest: 'unknown',
          updatedAt: new Date(),
        })),
      }));
    } catch {
      return [];
    }
  }

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

  async analyzeRepo(
    owner: string,
    repo: string,
    file?: Express.Multer.File,
    rawJson?: string | Record<string, unknown>,
    token?: string,
  ) {
    const repoKey = `repo:${owner}/${repo}`;
    const repoData = await this.requestWithCache<GitHubRepoResponse>(
      repoKey,
      () => this.fetchRepo(owner, repo, token),
      1000 * 60 * 5,
    );

    const commitActivity = await this.requestWithCache<CommitActivityItem[]>(
      `commits:${owner}/${repo}`,
      () => this.fetchCommitActivity(owner, repo, token),
      1000 * 60 * 3,
    );

    const securityAlerts = await this.requestWithCache<any[]>(
      `alerts:${owner}/${repo}`,
      () => this.fetchSecurityAlerts(owner, repo, token),
      1000 * 60 * 3,
    );

    const { dependencyHealth, riskyDependencies } =
      await this._processDependencies(file, rawJson, this.dockerAvailable);

    const overallHealth = this._calculateHealthScore(
      repoData,
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
        name: repoData.name,
        stars: repoData.stargazers_count,
        forks: repoData.forks_count,
        open_issues: repoData.open_issues_count,
        last_pushed: new Date(repoData.pushed_at),
        commit_activity: Array.isArray(commitActivity)
          ? commitActivity.map((c) =>
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

  async processDependencies(
    file?: Express.Multer.File,
    rawJson?: string | Record<string, unknown>,
  ): Promise<{ dependencyHealth: number; riskyDependencies: string[] }> {
    return this._processDependencies(file, rawJson, this.dockerAvailable);
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

  async analyzeByUrl(
    url: string,
    file?: Express.Multer.File,
    rawJson?: string | Record<string, unknown>,
    token?: string,
  ) {
    const { owner, repo } = this.parseGitHubUrl(url);

    return this.analyzeRepo(owner, repo, file, rawJson, token);
  }

  async analyzeJson(rawJson: string | Record<string, unknown>) {
    const parsed = this._parseJson(rawJson);
    const deps = this._extractDependencies(parsed) ?? {};
    const analysis = await this.dependencyAnalyzer.analyzeDependencies(deps);

    let projectName = 'unknown';
    if ('name' in parsed && typeof parsed.name === 'string') {
      projectName = parsed.name;
    }

    const totalDependencies = Object.keys(deps).length;

    return {
      project_name: projectName,
      total_dependencies: totalDependencies,
      dependencies: deps,
      dependency_health: {
        score: analysis.score,
        health: analysis.health,
        total_vulnerabilities: analysis.totalVulns ?? 0,
        total_outdated: analysis.totalOutdated ?? 0,
      },
      risky_dependencies: analysis.risky ?? [],
      outdated_dependencies: analysis.outdated ?? [],
      unstable_dependencies: analysis.unstable ?? [],
    };
  }

  private async _processDependencies(
    file?: Express.Multer.File,
    rawJson?: string | Record<string, unknown>,
    useDocker = false,
  ): Promise<{ dependencyHealth: number; riskyDependencies: string[] }> {
    let deps: Record<string, string> = {};

    if (rawJson) {
      deps = this._getDependenciesFromJson(rawJson);
    } else if (file) {
      deps = this._getDependenciesFromFile(file);
    }

    if (!deps || Object.keys(deps).length === 0) {
      return { dependencyHealth: 100, riskyDependencies: [] };
    }

    const release = await this.analysisSemaphore.acquire();
    try {
      const analysis = await this.dependencyAnalyzer.analyzeDependencies(
        deps,
        useDocker ? { useDocker } : undefined,
      );
      return {
        dependencyHealth:
          typeof analysis?.score === 'number' ? analysis.score : 100,
        riskyDependencies: Array.isArray(analysis?.risky) ? analysis.risky : [],
      };
    } finally {
      release();
    }
  }

  /** Safe fetching helpers with small in-memory cache + retry/backoff */
  private async requestWithCache<T>(
    key: string,
    fn: () => Promise<T>,
    ttlMs = 60_000,
  ): Promise<T> {
    const existing = this.cache.get(key) as CacheEntry<T> | undefined;
    const now = Date.now();
    if (existing && now - existing.createdAt < existing.ttlMs) {
      return existing.value;
    }
    const value = await this.requestWithRetry(fn, 3, 300);
    this.cache.set(key, { createdAt: now, ttlMs, value });
    return value;
  }

  private async requestWithRetry<T>(
    fn: () => Promise<T>,
    attempts = 3,
    baseDelayMs = 300,
  ): Promise<T> {
    let lastErr: unknown = null;
    for (let i = 0; i < attempts; i++) {
      try {
        return await fn();
      } catch (err) {
        lastErr = err;
        const delay = baseDelayMs * Math.pow(2, i);
        await new Promise((res) => setTimeout(res, delay));
      }
    }
    if (lastErr instanceof Error) {
      throw lastErr;
    } else {
      throw new Error('request failed');
    }
  }

  private parseGitHubUrl(url: string): { owner: string; repo: string } {
    try {
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

      const { owner, repo } = match.groups;
      return { owner, repo };
    } catch {
      throw new HttpException(
        'Invalid GitHub repository URL',
        HttpStatus.BAD_REQUEST,
      );
    }
  }

  private async fetchRepo(
    owner: string,
    repo: string,
    token?: string,
  ): Promise<GitHubRepoResponse> {
    try {
      const headers: Record<string, string> = {
        Accept: 'application/vnd.github.v3+json',
        'User-Agent': 'package-health-service',
      };
      const authToken = token?.trim() || process.env.GITHUB_TOKEN;
      if (authToken) {
        headers['Authorization'] = `Bearer ${authToken}`;
      }
      const url = `https://api.github.com/repos/${owner}/${repo}`;
      const res = await lastValueFrom(
        this.httpService.get<GitHubRepoResponse>(url, { headers }),
      );
      return res.data;
    } catch {
      throw new HttpException(
        'Failed to fetch repository data from GitHub',
        HttpStatus.BAD_GATEWAY,
      );
    }
  }

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
      const res = await lastValueFrom(
        this.httpService.get<unknown>(url, { headers }),
      );
      if (res.status === 202) return [];
      const data = res.data;
      if (!Array.isArray(data)) return [];
      return data.map((item: any) => {
        if (
          typeof item === 'object' &&
          item !== null &&
          'week' in item &&
          'total' in item &&
          typeof (item as { week: unknown }).week === 'number' &&
          typeof (item as { total: unknown }).total === 'number'
        ) {
          return {
            week: (item as { week: number }).week,
            total: (item as { total: number }).total,
          };
        }
        return { week: 0, total: 0 };
      });
    } catch {
      return [];
    }
  }

  private async fetchSecurityAlerts(
    owner: string,
    repo: string,
    token?: string,
  ): Promise<any[]> {
    try {
      const headers: Record<string, string> = {
        Accept: 'application/vnd.github.v3+json',
      };
      if (token) headers['Authorization'] = `Bearer ${token}`;
      const url = `https://api.github.com/repos/${owner}/${repo}/vulnerability-alerts`;
      const res = await lastValueFrom(this.httpService.get(url, { headers }));
      if (res.status === 204) return [true];
      if (res.status === 404) return [];
      return [];
    } catch {
      return [];
    }
  }

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

  private _extractDependencies(
    packageJson: Record<string, unknown>,
  ): Record<string, string> {
    const deps: Record<string, string> = {};
    const addDeps = (source: unknown) => {
      if (typeof source === 'object' && source !== null) {
        for (const [key, value] of Object.entries(
          source as Record<string, unknown>,
        )) {
          if (typeof value === 'string') deps[key] = value;
        }
      }
    };
    addDeps(packageJson.dependencies);
    addDeps(packageJson.devDependencies);
    return deps;
  }

  private _getDependenciesFromJson(
    rawJson: string | Record<string, unknown>,
    isLockFile = false,
  ): Record<string, string> {
    const parsed = this._parseJson(rawJson);

    if (isLockFile) {
      const deps: Record<string, string> = {};
      const extractDeps = (packages: unknown) => {
        if (typeof packages !== 'object' || packages === null) return;

        for (const [name, info] of Object.entries(
          packages as Record<string, unknown>,
        )) {
          if (
            typeof info === 'object' &&
            info !== null &&
            'version' in info &&
            typeof (info as { version?: unknown }).version === 'string'
          ) {
            deps[name] = (info as { version: string }).version;
            if (
              'dependencies' in info &&
              typeof (info as { dependencies?: unknown }).dependencies ===
                'object' &&
              (info as { dependencies?: unknown }).dependencies !== null
            ) {
              extractDeps((info as { dependencies: unknown }).dependencies);
            }
          }
        }
      };
      if (
        parsed &&
        typeof parsed === 'object' &&
        'dependencies' in parsed &&
        typeof parsed.dependencies === 'object' &&
        parsed.dependencies !== null
      ) {
        extractDeps(parsed.dependencies);
      }
      return deps;
    }

    return this._extractDependencies(parsed);
  }

  public _getDependenciesFromFile(
    file: Express.Multer.File,
  ): Record<string, string> {
    const deps: Record<string, string> = {};

    const isZip =
      file.mimetype === 'application/zip' || file.originalname.endsWith('.zip');

    if (isZip) {
      try {
        const zip = new AdmZip(file.buffer);
        const entries = zip.getEntries();

        entries.forEach((entry) => {
          if (!entry.isDirectory) {
            const baseName = path.basename(entry.entryName).toLowerCase();
            if (
              baseName === 'package.json' ||
              baseName === 'package-lock.json'
            ) {
              const buffer = entry.getData();
              if (!Buffer.isBuffer(buffer)) return;

              const content = buffer.toString('utf-8');
              const isLock = baseName === 'package-lock.json';
              const fileDeps = this._getDependenciesFromJson(content, isLock);
              Object.assign(deps, fileDeps);
            }
          }
        });

        if (Object.keys(deps).length === 0) {
          throw new HttpException(
            'No package.json or package-lock.json found in the uploaded zip folder.',
            HttpStatus.BAD_REQUEST,
          );
        }

        return deps;
      } catch {
        throw new HttpException(
          'Failed to read or parse the uploaded zip folder.',
          HttpStatus.BAD_REQUEST,
        );
      }
    }

    if (
      file.originalname.endsWith('package.json') ||
      file.originalname.endsWith('package-lock.json')
    ) {
      const content = file.buffer.toString('utf-8');
      const isLock = file.originalname.endsWith('package-lock.json');
      return this._getDependenciesFromJson(content, isLock);
    }

    throw new HttpException(
      'Unsupported file type. Please upload a zip folder or package.json/package-lock.json file.',
      HttpStatus.BAD_REQUEST,
    );
  }

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

    const weighted =
      (starsScore * WEIGHTS.STARS +
        forksScore * WEIGHTS.FORKS +
        recencyScore * WEIGHTS.RECENCY +
        commitScore * WEIGHTS.COMMITS +
        dependencyScore * WEIGHTS.DEPENDENCIES +
        issuePenalty * WEIGHTS.ISSUES +
        securityPenalty * WEIGHTS.SECURITY) *
      100;

    const score = Math.round(Math.max(0, Math.min(weighted, 100)));

    const label =
      score >= 80
        ? 'Excellent'
        : score >= 60
          ? 'Good'
          : score >= 40
            ? 'Moderate'
            : 'Poor';

    return { score, label };
  }
}
