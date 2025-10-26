import { HttpException, HttpStatus, Injectable, Logger } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { lastValueFrom } from 'rxjs';
import {
  GitHubRepoResponse,
  CommitActivityItem,
  CacheEntry,
} from '../repo-health.interface';

@Injectable()
export class GithubApiService {
  private readonly logger = new Logger(GithubApiService.name);
  private readonly cache = new Map<string, CacheEntry<unknown>>();

  constructor(private readonly httpService: HttpService) {}

  buildHeaders(token?: string): Record<string, string> {
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

  async makeGitHubRequest<T>(url: string, token?: string): Promise<T> {
    const headers = this.buildHeaders(token);
    const response = await lastValueFrom(
      this.httpService.get<T>(url, { headers }),
    );
    return response.data;
  }

  async fetchRepositoryData(
    owner: string,
    repo: string,
    token?: string,
  ): Promise<GitHubRepoResponse> {
    try {
      const url = `https://api.github.com/repos/${owner}/${repo}`;
      return await this.makeGitHubRequest<GitHubRepoResponse>(url, token);
    } catch (err: any) {
      const status = err?.response?.status ?? 0;
      if (status === 404) {
        throw new HttpException(
          `Repository '${owner}/${repo}' not found.`,
          HttpStatus.NOT_FOUND,
        );
      } else if (status === 401 || status === 403) {
        throw new HttpException(
          'Invalid or expired GitHub token provided.',
          HttpStatus.BAD_REQUEST,
        );
      }
      throw new HttpException(
        `Failed to fetch repository '${owner}/${repo}'.`,
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  async fetchCommitActivity(
    owner: string,
    repo: string,
    token?: string,
  ): Promise<CommitActivityItem[]> {
    try {
      const url = `https://api.github.com/repos/${owner}/${repo}/stats/commit_activity`;
      const data = await this.makeGitHubRequest<any>(url, token);

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

  async fetchSecurityAlerts(
    owner: string,
    repo: string,
    token?: string,
  ): Promise<any[]> {
    try {
      const url = `https://api.github.com/repos/${owner}/${repo}/vulnerability-alerts`;
      await this.makeGitHubRequest(url, token);
      return [true];
    } catch (err: any) {
      this.logger.debug(`Security alerts not available for ${owner}/${repo}`);
      return [];
    }
  }

  async determineRepoVisibility(
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
      const headers = this.buildHeaders();
      const url = `https://api.github.com/repos/${owner}/${repo}`;
      await lastValueFrom(this.httpService.get(url, { headers }));

      const visibility: 'public' | 'private' = 'public';
      this.cache.set(cacheKey, {
        createdAt: Date.now(),
        ttlMs: 1000 * 60 * 60,
        value: visibility,
      });
      return visibility;
    } catch (err: any) {
      const status = err?.response?.status ?? 0;

      if (status === 401 || status === 403) {
        const visibility: 'public' | 'private' = 'private';
        this.cache.set(cacheKey, {
          createdAt: Date.now(),
          ttlMs: 1000 * 60 * 30,
          value: visibility,
        });
        return visibility;
      } else if (status === 404) {
        throw new HttpException(
          `Repository '${owner}/${repo}' not found.`,
          HttpStatus.NOT_FOUND,
        );
      } else {
        const visibility: 'public' | 'private' = 'public';
        this.cache.set(cacheKey, {
          createdAt: Date.now(),
          ttlMs: 1000 * 60 * 5,
          value: visibility,
        });
        return visibility;
      }
    }
  }
}
