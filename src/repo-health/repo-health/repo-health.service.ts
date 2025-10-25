import { HttpException, HttpStatus, Injectable, Logger } from '@nestjs/common';
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
  private?: boolean;
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
    return new Promise<() => void>((resolve) => {
      const tryAcquire = () => {
        if (this.counter < this.max) {
          this.counter++;
          resolve(() => {
            this.counter = Math.max(0, this.counter - 1);
            process.nextTick(() => this.tryReleaseNext());
          });
          return true;
        }
        return false;
      };

      if (!tryAcquire()) {
        this.queue.push(tryAcquire);
      }
    });
  }

  private tryReleaseNext(): void {
    if (this.queue.length > 0 && this.counter < this.max) {
      const next = this.queue.shift();
      if (next) {
        process.nextTick(next);
      }
    }
  }
}

@Injectable()
export class RepoHealthService {
  private readonly logger = new Logger(RepoHealthService.name);
  private readonly analysisSemaphore = new Semaphore(4);
  private readonly cache = new Map<string, CacheEntry<unknown>>();
  private readonly CACHE_CLEANUP_INTERVAL = 1000 * 60 * 30;

  private _dockerAvailable: boolean | null = null;

  constructor(
    @InjectModel(RepoHealth.name)
    private readonly repoHealthModel: Model<RepoHealthDocument>,
    private readonly httpService: HttpService,
    private readonly dependencyAnalyzer: DependencyAnalyzerService,
  ) {
    this.startCacheCleanup();
  }

  private startCacheCleanup(): void {
    setInterval(() => this.cleanupExpiredCache(), this.CACHE_CLEANUP_INTERVAL);
    this.logger.log('Cache cleanup scheduler started');
  }

  private cleanupExpiredCache(): void {
    const now = Date.now();
    let cleanedCount = 0;

    for (const [key, entry] of this.cache.entries()) {
      if (now - entry.createdAt > entry.ttlMs) {
        this.cache.delete(key);
        cleanedCount++;
      }
    }

    if (cleanedCount > 0) {
      this.logger.debug(`Cleaned ${cleanedCount} expired cache entries`);
    }
  }

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

  // Determine if a repository is public or private

  private async determineRepoVisibility(
    owner: string,
    repo: string,
  ): Promise<'public' | 'private'> {
    const cacheKey = `visibility:${owner}/${repo}`;
    const cached = this.cache.get(cacheKey) as
      | CacheEntry<'public' | 'private'>
      | undefined;

    if (cached && Date.now() - cached.createdAt < cached.ttlMs) {
      return cached.value;
    }

    try {
      const headers = this.buildHeaders(); // No token
      const url = `https://api.github.com/repos/${owner}/${repo}`;

      const res = await lastValueFrom(this.httpService.get(url, { headers }));

      // If we can access it without token, it's definitely public
      const visibility: 'public' | 'private' = 'public';
      this.cache.set(cacheKey, {
        createdAt: Date.now(),
        ttlMs: 1000 * 60 * 60, // Cache for 1 hour
        value: visibility,
      });

      return visibility;
    } catch (err: any) {
      const status = err?.response?.status ?? 0;

      // If we get 401/403 without token, it's private
      if (status === 401 || status === 403) {
        const visibility: 'public' | 'private' = 'private';
        this.cache.set(cacheKey, {
          createdAt: Date.now(),
          ttlMs: 1000 * 60 * 30, // Cache for 30 minutes
          value: visibility,
        });
        return visibility;
      } else if (status === 404) {
        throw new HttpException(
          `Repository '${owner}/${repo}' not found.`,
          HttpStatus.NOT_FOUND,
        );
      } else {
        // For network errors, timeouts, etc., assume public and try to proceed
        this.logger.warn(
          `Could not determine visibility for ${owner}/${repo}, assuming public. Status: ${status}`,
        );
        const visibility: 'public' | 'private' = 'public';
        this.cache.set(cacheKey, {
          createdAt: Date.now(),
          ttlMs: 1000 * 60 * 5, // Short cache for uncertain cases
          value: visibility,
        });
        return visibility;
      }
    }
  }

  // Fetch data from a PUBLIC repository

  private async fetchPublicRepo(
    owner: string,
    repo: string,
    token?: string,
  ): Promise<GitHubRepoResponse> {
    const baseUrl = `https://api.github.com/repos/${owner}/${repo}`;

    // For public repos, try with token first if provided, then without
    if (token) {
      try {
        const headers = this.buildHeaders(token);
        const res = await lastValueFrom(
          this.httpService.get<GitHubRepoResponse>(baseUrl, { headers }),
        );
        return res.data;
      } catch (err: any) {
        // If token fails for public repo, just try without token
        this.logger.debug(
          `Token failed for public repo ${owner}/${repo}, trying without token`,
        );
      }
    }

    // Try without token for public repos
    try {
      const headers = this.buildHeaders(); // No token
      const res = await lastValueFrom(
        this.httpService.get<GitHubRepoResponse>(baseUrl, { headers }),
      );
      return res.data;
    } catch (err: any) {
      const status = err?.response?.status ?? 0;
      if (status === 404) {
        throw new HttpException(
          `Repository '${owner}/${repo}' not found.`,
          HttpStatus.NOT_FOUND,
        );
      }
      throw new HttpException(
        `Failed to fetch public repository '${owner}/${repo}'.`,
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  // Fetch data from a PRIVATE repository

  private async fetchPrivateRepo(
    owner: string,
    repo: string,
    token?: string,
  ): Promise<GitHubRepoResponse> {
    const baseUrl = `https://api.github.com/repos/${owner}/${repo}`;

    // For private repos, we absolutely need a valid token
    if (!token) {
      throw new HttpException(
        `Repository '${owner}/${repo}' is private and requires a GitHub token.`,
        HttpStatus.BAD_REQUEST,
      );
    }

    try {
      const headers = this.buildHeaders(token);
      const res = await lastValueFrom(
        this.httpService.get<GitHubRepoResponse>(baseUrl, { headers }),
      );
      return res.data;
    } catch (err: any) {
      const status = err?.response?.status ?? 0;
      if (status === 401 || status === 403) {
        throw new HttpException(
          'Invalid or expired GitHub token provided for private repository.',
          HttpStatus.BAD_REQUEST,
        );
      } else if (status === 404) {
        throw new HttpException(
          `Repository '${owner}/${repo}' not found.`,
          HttpStatus.NOT_FOUND,
        );
      }
      throw new HttpException(
        `Failed to fetch private repository '${owner}/${repo}'.`,
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  // Main repository fetcher - routes to appropriate function based on visibility

  private async fetchRepo(
    owner: string,
    repo: string,
    token?: string,
  ): Promise<GitHubRepoResponse> {
    // First determine the repository visibility
    const visibility = await this.determineRepoVisibility(owner, repo);

    // Route to the appropriate fetcher based on visibility
    if (visibility === 'public') {
      return this.fetchPublicRepo(owner, repo, token);
    } else {
      return this.fetchPrivateRepo(owner, repo, token);
    }
  }

  // Public method to check repository visibility

  async checkRepoVisibility(
    url: string,
    token?: string,
  ): Promise<{ visibility: 'public' | 'private' }> {
    try {
      const { owner, repo } = this.parseGitHubUrl(url);
      const visibility = await this.determineRepoVisibility(owner, repo);
      return { visibility };
    } catch (error) {
      if (error instanceof HttpException) throw error;
      this.logger.error(`Failed to check visibility for ${url}:`, error);
      throw new HttpException(
        'Failed to check repository visibility',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
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
    } catch (error) {
      this.logger.error(`Failed to find repository ${owner}/${repo}:`, error);
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

      if (owner) mongoQuery['owner'] = owner;
      if (repo) mongoQuery['repo'] = repo;
      if (minHealthScore !== undefined) {
        mongoQuery['overall_health.score'] = { $gte: minHealthScore };
      }

      const records = await this.repoHealthModel
        .find(mongoQuery)
        .skip(offset)
        .limit(limit)
        .exec();

      return records;
    } catch (error) {
      this.logger.error('Failed to find repositories:', error);
      throw new HttpException(
        'Failed to find repositories',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  async findAll(): Promise<RepoHealthDocument[]> {
    try {
      return await this.repoHealthModel.find().exec();
    } catch (error) {
      this.logger.error('Failed to retrieve all repositories:', error);
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
    } catch (error) {
      this.logger.error('Failed to get repository statuses:', error);
      return [];
    }
  }

  async findRepoHealth(
    owner: string,
    repo: string,
  ): Promise<RepoHealthDocument> {
    try {
      const record = await this.repoHealthModel.findOne({ owner, repo }).exec();
      if (!record) {
        throw new HttpException(
          `No analysis found for ${owner}/${repo}`,
          HttpStatus.NOT_FOUND,
        );
      }
      return record;
    } catch (error) {
      if (error instanceof HttpException) throw error;
      this.logger.error(
        `Failed to find repo health for ${owner}/${repo}:`,
        error,
      );
      throw new HttpException(
        'Failed to retrieve repository health',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  async analyzeRepo(
    owner: string,
    repo: string,
    file?: Express.Multer.File,
    rawJson?: string | Record<string, unknown>,
    token?: string,
  ): Promise<RepoHealthDocument> {
    const repoKey = `repo:${owner}/${repo}`;

    try {
      const repoData = await this.requestWithCache<GitHubRepoResponse>(
        repoKey,
        () => this.fetchRepo(owner, repo, token),
        1000 * 60 * 5,
      );

      if (!repoData) {
        throw new HttpException(
          `Repository ${owner}/${repo} not found`,
          HttpStatus.NOT_FOUND,
        );
      }

      const [commitActivity, securityAlerts, dependencyAnalysis] =
        await Promise.allSettled([
          this.requestWithCache<CommitActivityItem[]>(
            `commits:${owner}/${repo}`,
            () => this.fetchCommitActivity(owner, repo, token),
            1000 * 60 * 3,
          ),
          this.requestWithCache<any[]>(
            `alerts:${owner}/${repo}`,
            () => this.fetchSecurityAlerts(owner, repo, token),
            1000 * 60 * 3,
          ),
          this._processDependencies(file, rawJson),
        ]);

      const commitActivityValue =
        commitActivity.status === 'fulfilled' ? commitActivity.value : [];
      const securityAlertsValue =
        securityAlerts.status === 'fulfilled' ? securityAlerts.value : [];
      const dependencyAnalysisValue =
        dependencyAnalysis.status === 'fulfilled'
          ? dependencyAnalysis.value
          : this.getDefaultDependencyAnalysis();

      const overallHealth = this._calculateHealthScore(
        repoData,
        Array.isArray(commitActivityValue) ? commitActivityValue : [],
        Array.isArray(securityAlertsValue) ? securityAlertsValue : [],
        dependencyAnalysisValue.dependencyHealth,
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
          commit_activity: Array.isArray(commitActivityValue)
            ? commitActivityValue.map((c) =>
                typeof c.total === 'number' ? c.total : 0,
              )
            : [],
          security_alerts: Array.isArray(securityAlertsValue)
            ? securityAlertsValue.length
            : 0,
          dependency_health: dependencyAnalysisValue.dependencyHealth,
          risky_dependencies: dependencyAnalysisValue.riskyDependencies,
          overall_health: overallHealth,
          bundle_size: dependencyAnalysisValue.bundleSize,
          license_risks: dependencyAnalysisValue.licenseRisks,
          popularity: dependencyAnalysisValue.popularity,
          days_behind: dependencyAnalysisValue.daysBehind,
        },
        { new: true, upsert: true, setDefaultsOnInsert: true },
      );

      return updated;
    } catch (error) {
      this.logger.error(
        `Failed to analyze repository ${owner}/${repo}:`,
        error,
      );
      if (error instanceof HttpException) throw error;
      throw new HttpException(
        'Failed to analyze repository',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  async processDependencies(
    file?: Express.Multer.File,
    rawJson?: string | Record<string, unknown>,
  ): Promise<DependencyAnalysisResult> {
    return await this._processDependencies(file, rawJson);
  }

  async getCommitActivity(
    owner: string,
    repo: string,
    token?: string,
  ): Promise<CommitActivityItem[]> {
    return await this.fetchCommitActivity(owner, repo, token);
  }

  async getSecurityAlerts(
    owner: string,
    repo: string,
    token?: string,
  ): Promise<any[]> {
    return await this.fetchSecurityAlerts(owner, repo, token);
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
  ): Promise<RepoHealthDocument> {
    const { owner, repo } = this.parseGitHubUrl(url);
    return this.analyzeRepo(owner, repo, file, rawJson, token);
  }

  async analyzeJson(rawJson: string | Record<string, unknown>): Promise<any> {
    try {
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
    } catch (error) {
      this.logger.error('Failed to analyze JSON:', error);
      throw new HttpException(
        'Failed to analyze package.json',
        HttpStatus.BAD_REQUEST,
      );
    }
  }

  private async _processDependencies(
    file?: Express.Multer.File,
    rawJson?: string | Record<string, unknown>,
  ): Promise<DependencyAnalysisResult> {
    let deps: Record<string, string> = {};

    try {
      if (rawJson) {
        deps = this._getDependenciesFromJson(rawJson);
      } else if (file) {
        deps = this._getDependenciesFromFile(file);
      }

      if (!deps || Object.keys(deps).length === 0) {
        return this.getDefaultDependencyAnalysis();
      }

      const release = await this.analysisSemaphore.acquire();
      try {
        const analysis =
          await this.dependencyAnalyzer.analyzeDependencies(deps);
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
    } catch (error) {
      this.logger.error('Dependency analysis failed:', error);
      return this.getDefaultDependencyAnalysis();
    }
  }

  private getDefaultDependencyAnalysis(): DependencyAnalysisResult {
    return {
      dependencyHealth: 100,
      riskyDependencies: [],
      bundleSize: 0,
      licenseRisks: [],
      popularity: 0,
      daysBehind: 0,
    };
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
        if (i < attempts - 1) {
          const delay = baseDelayMs * Math.pow(2, i);
          await new Promise((res) => setTimeout(res, delay));
        }
      }
    }
    if (lastErr instanceof Error) {
      throw lastErr;
    } else {
      throw new Error('Request failed after retries');
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
    } catch (error) {
      this.logger.error('Failed to parse GitHub URL:', error);
      throw new HttpException(
        'Invalid GitHub repository URL',
        HttpStatus.BAD_REQUEST,
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
    } catch (err: any) {
      this.logger.debug(`Commit activity not available for ${owner}/${repo}`);
      return [];
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
    } catch (err: any) {
      this.logger.debug(`Security alerts not available for ${owner}/${repo}`);
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
    } catch (err) {
      this.logger.error('Failed to parse JSON:', err);
      throw new HttpException('Invalid JSON structure', HttpStatus.BAD_REQUEST);
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
    try {
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
    } catch (error) {
      this.logger.error('Failed to extract dependencies from JSON:', error);
      return {};
    }
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
        this.logger.error('Failed to extract dependencies from zip file:', err);
        throw new HttpException(
          'Failed to process zip file',
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

  private _getDependencies(
    file?: Express.Multer.File,
    rawJson?: string | Record<string, unknown>,
  ): Record<string, string> {
    if (rawJson) return this._getDependenciesFromJson(rawJson);
    if (file) return this._getDependenciesFromFile(file);
    return {};
  }

  /**
   * DEBUG METHOD: Check what's happening with repository visibility
   */
  async debugRepoVisibility(url: string, token?: string): Promise<any> {
    try {
      const { owner, repo } = this.parseGitHubUrl(url);

      // Test 1: Try without token
      let withoutTokenStatus: number = 0;
      let withoutTokenSuccess: boolean = false;
      try {
        const headers = this.buildHeaders(); // No token
        const testUrl = `https://api.github.com/repos/${owner}/${repo}`;
        const res = await lastValueFrom(
          this.httpService.get(testUrl, { headers }),
        );
        withoutTokenStatus = res.status;
        withoutTokenSuccess = true;
      } catch (err: any) {
        withoutTokenStatus = err?.response?.status ?? 0;
        withoutTokenSuccess = false;
      }

      // Test 2: Try with token if provided
      let withTokenStatus: number = 0;
      let withTokenSuccess: boolean = false;
      let withTokenTested: boolean = false;

      if (token) {
        withTokenTested = true;
        try {
          const headers = this.buildHeaders(token);
          const testUrl = `https://api.github.com/repos/${owner}/${repo}`;
          const res = await lastValueFrom(
            this.httpService.get(testUrl, { headers }),
          );
          withTokenStatus = res.status;
          withTokenSuccess = true;
        } catch (err: any) {
          withTokenStatus = err?.response?.status ?? 0;
          withTokenSuccess = false;
        }
      }

      const determinedVisibility = await this.determineRepoVisibility(
        owner,
        repo,
      );

      return {
        repository: `${owner}/${repo}`,
        tests: {
          withoutToken: {
            success: withoutTokenSuccess,
            status: withoutTokenStatus,
            accessible: withoutTokenSuccess,
          },
          withToken: withTokenTested
            ? {
                success: withTokenSuccess,
                status: withTokenStatus,
                accessible: withTokenSuccess,
              }
            : 'No token provided',
        },
        determinedVisibility,
        conclusion: withoutTokenSuccess
          ? 'Repository is PUBLIC (accessible without token)'
          : 'Repository is PRIVATE (not accessible without token)',
      };
    } catch (error) {
      this.logger.error(`Debug failed for ${url}:`, error);
      throw new HttpException('Debug failed', HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }
}
