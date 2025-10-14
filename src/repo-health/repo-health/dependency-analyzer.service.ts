import { Injectable, Logger } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { lastValueFrom } from 'rxjs';

@Injectable()
export class DependencyAnalyzerService {
  private readonly logger = new Logger(DependencyAnalyzerService.name);

  constructor(private readonly httpService: HttpService) {}

  async analyzeDependencies(dependencies: Record<string, string>) {
    const entries = Object.entries(dependencies ?? {});
    if (!entries.length) {
      return { score: 100, risky: [], outdated: [] };
    }

    const results = await Promise.allSettled(
      entries.map(async ([pkg, version]) => {
        try {
          const url = `https://registry.npmjs.org/${encodeURIComponent(pkg)}`;
          const response = await lastValueFrom(this.httpService.get(url));
          const data = (response?.data ?? {}) as {
            'dist-tags'?: { latest?: string };
          };

          const latestVersion = data['dist-tags']?.latest ?? null;
          const currentVersion = (version || '').replace(/^[^\d]*/, '');

          const isOutdated =
            latestVersion && currentVersion && currentVersion !== latestVersion;

          return {
            pkg,
            current: currentVersion,
            latest: latestVersion,
            outdated: isOutdated,
          };
        } catch (error) {
          this.logger.warn(`Failed to fetch ${pkg} info: ${error}`);
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

    const score = Math.max(
      100 - outdated.length * 2 - risky.length * 3 - entries.length / 20,
      0,
    );

    return {
      score: Number(score.toFixed(1)),
      outdated,
      risky,
    };
  }
}
