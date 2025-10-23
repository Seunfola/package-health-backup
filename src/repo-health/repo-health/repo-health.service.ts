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
import { GitHubErrorHandler } from 'src/utils/github-error.util';

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

type DependencyAnalysisResult = {
  dependencyHealth: number;
  riskyDependencies: string[];
  bundleSize: number;
  licenseRisks: string[];
  popularity: number;
  daysBehind: number;
};


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
  private visibilityCache = new Map<
    string,
    { isPublic: boolean; expiresAt: number }
  >();
  private VISIBILITY_TTL = 1000 * 60 * 60;

  private readonly cache = new Map<string, CacheEntry<unknown>>();

  private _dockerAvailable: boolean | null = null;
  constructor(
    @InjectModel(RepoHealth.name)
    private readonly repoHealthModel: Model<RepoHealthDocument>,
    private readonly httpService: HttpService,
    private readonly dependencyAnalyzer: DependencyAnalyzerService,
  ) {}

  private buildHeaders(token?: string): Record<string, string> {
    const headers: Record<string, string> = {
      Accept: 'application/vnd.github.v3+json',
      'User-Agent': 'package-health-service',
    };

    const effectiveToken = token?.trim();

    if (effectiveToken) {
      headers['Authorization'] = effectiveToken.startsWith('ghp_')
        ? `token ${effectiveToken}`
        : `Bearer ${effectiveToken}`;
    }

    return headers;
  }

  private detectDocker(): boolean {
    if (this._dockerAvailable !== null) return this._dockerAvailable;

    try {
      const detected =
        fs.existsSync('/.dockerenv') || fs.existsSync('/var/run/docker.sock');

      this._dockerAvailable = detected;
      return detected;
    } catch {
      this._dockerAvailable = false;
      return false;
    }
  }

  // Expose as readonly getter
  get dockerAvailable(): boolean {
    return this.detectDocker();
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
      async () => {
        const data = await this.fetchRepo(owner, repo, token);
        if (!data) {
          throw new HttpException(
            `Repository ${owner}/${repo} not found`,
            HttpStatus.NOT_FOUND,
          );
        }
        return data;
      },
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

    // Use refactored dependency analysis result
    const {
      dependencyHealth,
      riskyDependencies,
      bundleSize,
      licenseRisks,
      popularity,
      daysBehind,
    } = await this._processDependencies(file, rawJson);

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
        bundle_size: bundleSize,
        license_risks: licenseRisks,
        popularity,
        days_behind: daysBehind,
      },
      { new: true, upsert: true, setDefaultsOnInsert: true },
    );

    return updated.toObject();
  }

  async processDependencies(
    file?: Express.Multer.File,
    rawJson?: string | Record<string, unknown>,
  ): Promise<DependencyAnalysisResult> {
    const result = await this._processDependencies(file, rawJson);
    // Ensure result contains all required fields for DependencyAnalysisResult
    return {
      dependencyHealth: result.dependencyHealth,
      riskyDependencies: result.riskyDependencies,
      bundleSize: result.bundleSize,
      licenseRisks: result.licenseRisks,
      popularity: result.popularity,
      daysBehind: result.daysBehind,
    };
  }

  async getCommitActivity(owner: string, repo: string, token?: string) {
    return await this.fetchCommitActivity(owner, repo, token);
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

  private _getDependencies(
    file?: Express.Multer.File,
    rawJson?: string | Record<string, unknown>,
  ) {
    if (rawJson) return this._getDependenciesFromJson(rawJson);
    if (file) return this._getDependenciesFromFile(file);
    return {};
  }

  private async _processDependencies(
    file?: Express.Multer.File,
    rawJson?: string | Record<string, unknown>,
  ): Promise<DependencyAnalysisResult> {
    let deps: Record<string, string> = {};

    if (rawJson) {
      deps = this._getDependenciesFromJson(rawJson);
    } else if (file) {
      deps = this._getDependenciesFromFile(file);
    }

    if (!deps || Object.keys(deps).length === 0) {
      return {
        dependencyHealth: 100,
        riskyDependencies: [],
        bundleSize: 0,
        licenseRisks: [],
        popularity: 0,
        daysBehind: 0,
      };
    }

    const release = await this.analysisSemaphore.acquire();
    try {
      const analysis = await this.dependencyAnalyzer.analyzeDependencies(deps);
      return {
        dependencyHealth: analysis?.score ?? 100,
        riskyDependencies: analysis?.risky ?? [],
        bundleSize: analysis?.bundleSize ?? 0,
        licenseRisks: analysis?.licenseRisks ?? [],
        popularity: analysis?.popularity ?? 0,
        daysBehind: analysis?.daysBehind ?? 0,
      };
    } finally {
      release();
    }
  }

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
    const cacheKey = `${owner}/${repo}`;
    const baseUrl = `https://api.github.com/repos/${owner}/${repo}`;

    // Public cache
    const cached = this.visibilityCache.get(cacheKey);
    if (cached?.isPublic && cached.expiresAt > Date.now()) {
      try {
        const res = await lastValueFrom(
          this.httpService.get<GitHubRepoResponse>(baseUrl, {
            headers: this.buildHeaders(),
          }),
        );
        return res.data;
      } catch (err) {
        // do NOT retry with token for cached public repos
        throw new HttpException(
          `Failed to fetch public repository '${owner}/${repo}'.`,
          HttpStatus.INTERNAL_SERVER_ERROR,
        );
      }
    }

    // Unauthenticated request first
    try {
      const res = await lastValueFrom(
        this.httpService.get<GitHubRepoResponse>(baseUrl, {
          headers: this.buildHeaders(),
        }),
      );

      if (res.status === 200) {
        this.visibilityCache.set(cacheKey, {
          isPublic: true,
          expiresAt: Date.now() + 1000 * 60 * 60,
        });
      }

      return res.data;
    } catch (err: any) {
      const status = err?.response?.status ?? 0;

      // Retry with token only if private
      if ([401, 403].includes(status)) {
        if (!token) {
          throw new HttpException(
            'This repository is private. Provide a valid GitHub token.',
            HttpStatus.UNAUTHORIZED,
          );
        }

        try {
          const authRes = await lastValueFrom(
            this.httpService.get<GitHubRepoResponse>(baseUrl, {
              headers: this.buildHeaders(token),
            }),
          );
          if (authRes.status === 200) {
            this.visibilityCache.set(cacheKey, {
              isPublic: false,
              expiresAt: Date.now() + 1000 * 60 * 60,
            });
          }
          return authRes.data;
        } catch (authErr: any) {
          const authStatus = authErr?.response?.status ?? 0;
          const msg = authErr?.response?.data?.message?.toLowerCase() ?? '';
          if (authStatus === 401 || msg.includes('bad credentials')) {
            throw new HttpException(
              'Invalid or expired GitHub token provided.',
              HttpStatus.BAD_REQUEST,
            );
          }
          GitHubErrorHandler.handle(owner, repo, authErr, 'fetchRepo (authed)');
          throw new HttpException(
            `Failed to fetch private repository '${owner}/${repo}'.`,
            HttpStatus.INTERNAL_SERVER_ERROR,
          );
        }
      }

      if (status === 404) {
        throw new HttpException(
          `Repository '${owner}/${repo}' not found.`,
          HttpStatus.NOT_FOUND,
        );
      }

      GitHubErrorHandler.handle(owner, repo, err, 'fetchRepo (final)');
      throw new HttpException(
        `Failed to fetch repository '${owner}/${repo}'.`,
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  private async fetchCommitActivity(
    owner: string,
    repo: string,
    token?: string,
  ): Promise<CommitActivityItem[]> {
    try {
      const headers = this.buildHeaders(token);
      const url = `https://api.github.com/repos/${owner}/${repo}/stats/commit_activity`;
      const res = await lastValueFrom(
        this.httpService.get<unknown>(url, { headers }),
      );

      if (res.status === 202) return [];
      const data = res.data;
      if (!Array.isArray(data)) return [];
      return data.map((item: any) => ({
        week: typeof item.week === 'number' ? item.week : 0,
        total: typeof item.total === 'number' ? item.total : 0,
      }));
    } catch (err) {
      GitHubErrorHandler.handle(owner, repo, err, 'fetchCommitActivity');
    }
  }

  private async fetchSecurityAlerts(
    owner: string,
    repo: string,
    token?: string,
  ): Promise<any[]> {
    try {
      const headers = this.buildHeaders(token);
      const url = `https://api.github.com/repos/${owner}/${repo}/vulnerability-alerts`;
      const res = await lastValueFrom(this.httpService.get(url, { headers }));
      if (res.status === 204) return [true];
      if (res.status === 404) return [];
      return [];
    } catch (err) {
      GitHubErrorHandler.handle(owner, repo, err, 'fetchSecurityAlerts');
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
    } catch (err) {
      GitHubErrorHandler.handle('N/A', 'N/A', err, '_parseJson');
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
      } catch (err) {
        GitHubErrorHandler.handle(
          'N/A',
          'N/A',
          err,
          '_getDependenciesFromFile',
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
