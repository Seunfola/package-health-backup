import { Injectable, Logger } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { lastValueFrom, retry, catchError, throwError } from 'rxjs';
import { AxiosResponse } from 'axios';

interface NpmResponse {
  'dist-tags'?: { latest?: string };
}

@Injectable()
export class DependencyAnalyzerService {
  private readonly logger = new Logger(DependencyAnalyzerService.name);

  constructor(private readonly httpService: HttpService) {}

  /** Safely extract error message from unknown value */
  private extractErrorMessage(error: unknown): string {
    if (error instanceof Error && typeof error.message === 'string') {
      return error.message;
    }
    if (
      typeof error === 'object' &&
      error !== null &&
      'message' in error &&
      typeof (error as Record<string, unknown>).message === 'string'
    ) {
      return (error as Record<string, string>).message;
    }
    return String(error);
  }

  /** Analyze dependencies from a package.json dependency map */
  async analyzeDependencies(dependencies: Record<string, string>) {
    const entries = Object.entries(dependencies ?? {});
    if (entries.length === 0) {
      return { score: 100, risky: [], outdated: [] };
    }

    const results = await Promise.allSettled(
      entries.map(async ([pkg, version]) => {
        try {
          const url = `https://registry.npmjs.org/${encodeURIComponent(pkg)}`;
          const response: AxiosResponse<NpmResponse> = await lastValueFrom(
            this.httpService.get<NpmResponse>(url).pipe(
              retry({ count: 2, delay: 500 }),
              catchError((err: unknown) => {
                const message = this.extractErrorMessage(err);
                this.logger.warn(`Fetch failed for ${pkg}: ${message}`);
                return throwError(() => err);
              }),
            ),
          );

          const data = response?.data ?? {};
          const latestVersion = data['dist-tags']?.latest ?? null;
          const currentVersion = (version || '').replace(/^[^\d]*/, '');

          const isOutdated =
            latestVersion && currentVersion && currentVersion !== latestVersion;

          return {
            pkg,
            current: currentVersion,
            latest: latestVersion,
            outdated: Boolean(isOutdated),
          };
        } catch (error: unknown) {
          const message = this.extractErrorMessage(error);
          this.logger.warn(`Failed to analyze ${pkg}: ${message}`);
          return { pkg, error: true };
        }
      }),
    );

    const outdated = results
      .filter(
        (
          r,
        ): r is PromiseFulfilledResult<{
          pkg: string;
          current: string;
          latest: string | null;
          outdated: boolean;
        }> => r.status === 'fulfilled' && r.value.outdated === true,
      )
      .map((r) => r.value.pkg);

    const risky = results
      .filter(
        (r): r is PromiseFulfilledResult<{ pkg: string; error: true }> =>
          r.status === 'fulfilled' &&
          typeof r.value === 'object' &&
          r.value.error === true,
      )
      .map((r) => r.value.pkg);

    // Weighted scoring model
    const basePenalty =
      outdated.length * 2 + risky.length * 3 + entries.length / 20;
    const score = Math.max(100 - basePenalty, 0);

    return {
      score: Number(score.toFixed(1)),
      outdated,
      risky,
    };
  }
}
