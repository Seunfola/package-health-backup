// github-api.service.ts
import { HttpException, HttpStatus, Injectable, Logger } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { lastValueFrom } from 'rxjs';
import {
  GitHubRepoResponse,
  CommitActivityItem,
  SecurityAlert,
  CacheEntry,
  RepositoryNotFoundException,
  InvalidTokenException,
  RateLimitExceededException,
} from '../repo-health.interface';

@Injectable()
export class GithubApiService {
  private readonly logger = new Logger(GithubApiService.name);
  private readonly cache = new Map<string, CacheEntry<unknown>>();
  private readonly BASE_URL = 'https://api.github.com';
  private readonly CACHE_TTL = {
    VISIBILITY: 60 * 60 * 1000, // 1 hour
    REPO_DATA: 30 * 60 * 1000, // 30 minutes
  };

  constructor(private readonly httpService: HttpService) {}

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

  private async makeGitHubRequest<T>(
    url: string,
    token?: string,
    maxRetries = 3,
  ): Promise<T> {
    const headers = this.buildHeaders(token);

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        const response = await lastValueFrom(
          this.httpService.get<T>(url, {
            headers,
            timeout: 10000, // 10 second timeout
          }),
        );

        // Check rate limits
        const remaining = parseInt(
          response.headers['x-ratelimit-remaining'] || '0',
        );
        const resetTime =
          parseInt(response.headers['x-ratelimit-reset'] || '0') * 1000;

        if (remaining === 0) {
          throw new RateLimitExceededException(new Date(resetTime));
        }

        return response.data;
      } catch (error: any) {
        const isLastAttempt = attempt === maxRetries;

        if (isLastAttempt) {
          this.handleGitHubError(error, url);
        }

        // Exponential backoff for retries
        const backoffTime = Math.pow(2, attempt) * 1000;
        this.logger.warn(
          `Retry attempt ${attempt} for ${url}, waiting ${backoffTime}ms`,
        );
        await new Promise((resolve) => setTimeout(resolve, backoffTime));
      }
    }

    throw new HttpException(
      'Max retries exceeded for GitHub API request',
      HttpStatus.INTERNAL_SERVER_ERROR,
    );
  }

  private handleGitHubError(error: any, url: string): never {
    const status = error?.response?.status;
    const message = error?.response?.data?.message || error.message;

    this.logger.error(`GitHub API error for ${url}: ${status} - ${message}`);

    switch (status) {
      case 401:
      case 403:
        throw new InvalidTokenException();
      case 404:
        const { owner, repo } = this.extractOwnerRepoFromUrl(url);
        throw new RepositoryNotFoundException(owner, repo);
      case 422:
        throw new HttpException(
          `Validation failed for GitHub API: ${message}`,
          HttpStatus.BAD_REQUEST,
        );
      case 429:
        const resetTime = new Date(
          parseInt(error.response.headers['x-ratelimit-reset']) * 1000,
        );
        throw new RateLimitExceededException(resetTime);
      default:
        throw new HttpException(
          `GitHub API request failed: ${message}`,
          HttpStatus.INTERNAL_SERVER_ERROR,
        );
    }
  }

  private extractOwnerRepoFromUrl(url: string): {
    owner: string;
    repo: string;
  } {
    const match = url.match(/repos\/([^/]+)\/([^/]+)/);
    if (!match) {
      return { owner: 'unknown', repo: 'unknown' };
    }
    return { owner: match[1], repo: match[2] };
  }

  // PUBLIC REPOSITORY METHODS
  async fetchPublicRepositoryData(
    owner: string,
    repo: string,
  ): Promise<GitHubRepoResponse> {
    const url = `${this.BASE_URL}/repos/${owner}/${repo}`;
    return await this.makeGitHubRequest<GitHubRepoResponse>(url);
  }

  async fetchPublicCommitActivity(
    owner: string,
    repo: string,
  ): Promise<CommitActivityItem[]> {
    try {
      const url = `${this.BASE_URL}/repos/${owner}/${repo}/stats/commit_activity`;
      const data = await this.makeGitHubRequest<any>(url);

      if (!Array.isArray(data)) {
        return [];
      }

      return data.map((item: any) => ({
        week: typeof item.week === 'number' ? item.week : 0,
        total: typeof item.total === 'number' ? item.total : 0,
        days: Array.isArray(item.days) ? item.days : [],
      }));
    } catch (error: any) {
      this.logger.debug(`Commit activity not available for ${owner}/${repo}`);
      return [];
    }
  }

  async fetchPublicSecurityAlerts(
    owner: string,
    repo: string,
  ): Promise<SecurityAlert[]> {
    try {
      const url = `${this.BASE_URL}/repos/${owner}/${repo}/vulnerability-alerts`;
      const options = {
        headers: {
          ...this.buildHeaders(),
          Accept: 'application/vnd.github.dorian-preview+json',
        },
      };
      const data = await this.makeGitHubRequest<SecurityAlert[]>(url);
      return Array.isArray(data) ? data : [];
    } catch (error: any) {
      this.logger.debug(`Security alerts not available for ${owner}/${repo}`);
      return [];
    }
  }

  // PRIVATE REPOSITORY METHODS
  async fetchPrivateRepositoryData(
    owner: string,
    repo: string,
    token: string,
  ): Promise<GitHubRepoResponse> {
    if (!token?.trim()) {
      throw new HttpException(
        'Token is required for private repositories',
        HttpStatus.BAD_REQUEST,
      );
    }

    const url = `${this.BASE_URL}/repos/${owner}/${repo}`;
    return await this.makeGitHubRequest<GitHubRepoResponse>(url, token);
  }

  async fetchPrivateCommitActivity(
    owner: string,
    repo: string,
    token: string,
  ): Promise<CommitActivityItem[]> {
    if (!token?.trim()) {
      throw new HttpException(
        'Token is required for private repositories',
        HttpStatus.BAD_REQUEST,
      );
    }

    try {
      const url = `${this.BASE_URL}/repos/${owner}/${repo}/stats/commit_activity`;
      const data = await this.makeGitHubRequest<any>(url, token);

      if (!Array.isArray(data)) {
        return [];
      }

      return data.map((item: any) => ({
        week: typeof item.week === 'number' ? item.week : 0,
        total: typeof item.total === 'number' ? item.total : 0,
        days: Array.isArray(item.days) ? item.days : [],
      }));
    } catch (error: any) {
      this.logger.debug(`Commit activity not available for ${owner}/${repo}`);
      return [];
    }
  }

  async fetchPrivateSecurityAlerts(
    owner: string,
    repo: string,
    token: string,
  ): Promise<SecurityAlert[]> {
    if (!token?.trim()) {
      throw new HttpException(
        'Token is required for private repositories',
        HttpStatus.BAD_REQUEST,
      );
    }

    try {
      const url = `${this.BASE_URL}/repos/${owner}/${repo}/vulnerability-alerts`;
      const options = {
        headers: {
          ...this.buildHeaders(token),
          Accept: 'application/vnd.github.dorian-preview+json',
        },
      };
      const data = await this.makeGitHubRequest<SecurityAlert[]>(url, token);
      return Array.isArray(data) ? data : [];
    } catch (error: any) {
      this.logger.debug(`Security alerts not available for ${owner}/${repo}`);
      return [];
    }
  }

  // VISIBILITY DETECTION
  async determineRepoVisibility(
    owner: string,
    repo: string,
    token?: string,
  ): Promise<'public' | 'private'> {
    const cacheKey = `visibility:${owner}/${repo}`;
    const cached = this.cache.get(cacheKey) as
      | CacheEntry<'public' | 'private'>
      | undefined;

    if (cached && Date.now() - cached.createdAt < cached.ttlMs) {
      return cached.value;
    }

    try {
      const url = `${this.BASE_URL}/repos/${owner}/${repo}`;

      // Use public request if no token provided
      if (!token) {
        try {
          const repoData =
            await this.makeGitHubRequest<GitHubRepoResponse>(url);
          const visibility: 'public' | 'private' = repoData.private
            ? 'private'
            : 'public';

          this.cache.set(cacheKey, {
            createdAt: Date.now(),
            ttlMs: this.CACHE_TTL.VISIBILITY,
            value: visibility,
          });
          return visibility;
        } catch (error: any) {
          if (error?.response?.status === 404) {
            throw new RepositoryNotFoundException(owner, repo);
          }
          const visibility: 'public' | 'private' = 'private';
          this.cache.set(cacheKey, {
            createdAt: Date.now(),
            ttlMs: 5 * 60 * 1000,
            value: visibility,
          });
          return visibility;
        }
      } else {
        const repoData = await this.makeGitHubRequest<GitHubRepoResponse>(
          url,
          token,
        );
        const visibility: 'public' | 'private' = repoData.private
          ? 'private'
          : 'public';

        this.cache.set(cacheKey, {
          createdAt: Date.now(),
          ttlMs: this.CACHE_TTL.VISIBILITY,
          value: visibility,
        });
        return visibility;
      }
    } catch (error: any) {
      const status = error?.response?.status;

      if (status === 401 || status === 403) {
        // Token is invalid or doesn't have access
        if (token) {
          throw new InvalidTokenException();
        }
        const visibility: 'public' | 'private' = 'private';
        this.cache.set(cacheKey, {
          createdAt: Date.now(),
          ttlMs: this.CACHE_TTL.VISIBILITY,
          value: visibility,
        });
        return visibility;
      } else if (status === 404) {
        throw new RepositoryNotFoundException(owner, repo);
      } else {
        const visibility: 'public' | 'private' = 'public';
        this.cache.set(cacheKey, {
          createdAt: Date.now(),
          ttlMs: 5 * 60 * 1000,
          value: visibility,
        });
        return visibility;
      }
    }
  }

  // Batch operations for multiple repositories
  async batchFetchRepositories(
    repositories: Array<{ owner: string; repo: string; token?: string }>,
    concurrency = 3,
  ): Promise<
    Array<{
      owner: string;
      repo: string;
      data?: GitHubRepoResponse;
      error?: string;
    }>
  > {
    const results: Array<{
      owner: string;
      repo: string;
      data?: GitHubRepoResponse;
      error?: string;
    }> = [];

    // Process in batches to avoid rate limiting
    for (let i = 0; i < repositories.length; i += concurrency) {
      const batch = repositories.slice(i, i + concurrency);

      const batchResults = await Promise.allSettled(
        batch.map(async ({ owner, repo, token }) => {
          try {
            const data = token
              ? await this.fetchPrivateRepositoryData(owner, repo, token)
              : await this.fetchPublicRepositoryData(owner, repo);
            return { owner, repo, data };
          } catch (error: any) {
            return { owner, repo, error: error.message };
          }
        }),
      );

      batchResults.forEach((result) => {
        if (result.status === 'fulfilled') {
          results.push(result.value);
        }
      });

      // Rate limit protection
      if (i + concurrency < repositories.length) {
        await new Promise((resolve) => setTimeout(resolve, 1000));
      }
    }

    return results;
  }
}
