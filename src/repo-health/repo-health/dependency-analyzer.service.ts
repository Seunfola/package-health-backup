import { Injectable, HttpException, HttpStatus } from '@nestjs/common';
import { exec } from 'child_process';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { promisify } from 'util';

const execAsync = promisify(exec);

interface DependencyAnalysisResult {
  score: number;
  health: string;
  totalVulns: number;
  totalOutdated: number;
  risky: string[];
  vulnerabilities: Record<string, { severity: string; via: string[] }>;
  outdated: { name: string; current: string; latest: string }[];
  unstable: string[];
}

@Injectable()
export class DependencyAnalyzerService {
  async analyzeDependencies(
    deps: Record<string, string>,
    options?: { useDocker?: boolean },
  ): Promise<DependencyAnalysisResult> {
    const { useDocker = false } = options ?? {};

    for (const name of Object.keys(deps)) {
      if (!/^[a-zA-Z0-9._@/-]+$/.test(name)) {
        throw new HttpException(
          `Invalid dependency name: ${name}`,
          HttpStatus.BAD_REQUEST,
        );
      }
    }

    const tempDir = path.join(os.tmpdir(), `audit-${Date.now()}`);

    let cleanupSuccessful = false;

    try {
      await fs.promises.mkdir(tempDir, { recursive: true });

      const pkgJson = {
        name: 'audit-temp',
        version: '1.0.0',
        private: true,
        dependencies: deps,
      };

      await fs.promises.writeFile(
        path.join(tempDir, 'package.json'),
        JSON.stringify(pkgJson, null, 2),
      );

      await this.safeExec(
        'npm install --ignore-scripts --silent --no-audit --no-fund',
        tempDir,
        120_000,
        useDocker,
      );

      const outdated = await this.safeJsonExec(
        'npm outdated --json',
        tempDir,
        60_000,
        useDocker,
      );

      const auditResult = await this.safeJsonExec(
        'npm audit --json',
        tempDir,
        60_000,
        useDocker,
      );

      const vulnerabilities = this.extractVulnerabilities(auditResult);
      const risky = Object.keys(vulnerabilities);
      const outdatedList = this.extractOutdated(outdated);

      const { score, health } = this.calculateHealthScore(
        vulnerabilities,
        outdatedList,
      );
      const unstable = this.detectUnstableDeps(deps);

      cleanupSuccessful = true;

      return {
        score,
        health,
        totalVulns: Object.keys(vulnerabilities).length,
        totalOutdated: outdatedList.length,
        risky,
        vulnerabilities,
        outdated: outdatedList,
        unstable,
      };
    } catch (error: unknown) {
      const message =
        typeof error === 'object' &&
        error !== null &&
        'message' in error &&
        typeof (error as { message?: unknown }).message === 'string'
          ? (error as { message: string }).message
          : String(error);
      throw new HttpException(
        `Dependency analysis failed: ${message}`,
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    } finally {
      if (!cleanupSuccessful) {
        await this.cleanupDirectory(tempDir);
      } else {
        setTimeout(() => {
          this.cleanupDirectory(tempDir).catch(() => {
            console.warn(`Failed to cleanup directory: ${tempDir}`);
          });
        }, 5000);
      }
    }
  }

  private async safeExec(
    command: string,
    cwd: string,
    timeout = 120_000,
    useDocker = false,
  ) {
    const wrapped = useDocker
      ? `docker run --rm -v ${cwd}:/app -w /app node:20-alpine sh -c "${command}"`
      : command;

    return execAsync(wrapped, {
      cwd,
      timeout,
      killSignal: 'SIGKILL',
    });
  }

  private async safeJsonExec(
    command: string,
    cwd: string,
    timeout = 60_000,
    useDocker = false,
  ): Promise<Record<string, unknown>> {
    try {
      const { stdout } = await this.safeExec(command, cwd, timeout, useDocker);
      const parsed: unknown = JSON.parse(stdout || '{}');
      if (
        typeof parsed === 'object' &&
        parsed !== null &&
        !Array.isArray(parsed)
      ) {
        return parsed as Record<string, unknown>;
      }
      return {};
    } catch {
      return {};
    }
  }

  private extractVulnerabilities(auditJson: Record<string, unknown>) {
    const result: Record<string, { severity: string; via: string[] }> = {};
    let vulns: Record<string, unknown> = {};

    if (auditJson && typeof auditJson === 'object') {
      if (
        'vulnerabilities' in auditJson &&
        typeof auditJson.vulnerabilities === 'object'
      ) {
        vulns = (auditJson as { vulnerabilities: Record<string, unknown> })
          .vulnerabilities;
      } else if (
        'advisories' in auditJson &&
        typeof auditJson.advisories === 'object'
      ) {
        vulns = (auditJson as { advisories: Record<string, unknown> })
          .advisories;
      }
    }

    for (const [pkg, data] of Object.entries(vulns)) {
      if (!data || typeof data !== 'object') continue;

      const via: string[] = Array.isArray((data as { via?: unknown }).via)
        ? (data as { via: unknown[] }).via
            .map((v) =>
              typeof v === 'string'
                ? v
                : typeof v === 'object' &&
                    v !== null &&
                    'title' in v &&
                    typeof (v as { title?: unknown }).title === 'string'
                  ? (v as { title: string }).title
                  : '',
            )
            .filter((str): str is string => Boolean(str))
        : [];

      const severity: string =
        typeof (data as { severity?: unknown }).severity === 'string'
          ? (data as { severity: string }).severity
          : 'info';

      result[pkg] = { severity, via };
    }

    return result;
  }

  private extractOutdated(outdatedJson: Record<string, any>) {
    const list: { name: string; current: string; latest: string }[] = [];

    for (const [pkg, info] of Object.entries(outdatedJson)) {
      if (typeof info === 'object' && info !== null) {
        const current =
          typeof (info as { current?: unknown }).current === 'string'
            ? (info as { current?: string }).current!
            : 'unknown';
        const latest =
          typeof (info as { latest?: unknown }).latest === 'string'
            ? (info as { latest?: string }).latest!
            : 'unknown';

        list.push({ name: pkg, current, latest });
      }
    }

    return list;
  }

  private calculateHealthScore(
    vulnerabilities: Record<string, any>,
    outdated: any[],
  ) {
    const totalVulns = Object.keys(vulnerabilities).length;
    const totalOutdated = outdated.length;

    const score = Math.max(0, 100 - totalVulns * 5 - totalOutdated * 1.5);

    let health = 'Excellent';
    if (score < 80) health = 'Good';
    if (score < 60) health = 'Moderate';
    if (score < 40) health = 'Poor';

    return { score, health, totalVulns, totalOutdated };
  }

  private detectUnstableDeps(deps: Record<string, string>) {
    return Object.entries(deps)
      .filter(([, version]) => /alpha|beta|rc|snapshot|next/i.test(version))
      .map(([pkg]) => pkg);
  }

  private async cleanupDirectory(dir: string): Promise<void> {
    if (!fs.existsSync(dir)) return;

    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        await fs.promises.rm(dir, { recursive: true, force: true });
        console.log(`✅ Successfully cleaned up directory: ${dir}`);
        return;
      } catch (err) {
        const code =
          typeof err === 'object' && err !== null && 'code' in err
            ? (err as { code?: string }).code
            : undefined;
        const message =
          typeof err === 'object' && err !== null && 'message' in err
            ? (err as { message?: string }).message
            : String(err);

        if (code === 'EBUSY' || code === 'ENOTEMPTY') {
          console.warn(
            `⚠️ Cleanup attempt ${attempt + 1} failed for ${dir}: ${message}`,
          );
          if (attempt < 2)
            await new Promise((resolve) =>
              setTimeout(resolve, 2000 * (attempt + 1)),
            );
        } else if (
          typeof err === 'object' &&
          err !== null &&
          'code' in err &&
          (err as { code?: string }).code === 'ENOENT'
        ) {
          console.log(`Directory already deleted: ${dir}`);
          return;
        } else {
          const message =
            typeof err === 'object' && err !== null && 'message' in err
              ? (err as { message?: string }).message
              : String(err);
          console.error(`Unexpected cleanup error for ${dir}:`, message);
          break;
        }
      }
    }

    console.error(`Failed to cleanup directory after 3 attempts: ${dir}`);
  }
}
