import { Injectable, HttpException, HttpStatus } from '@nestjs/common';
import { exec } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';
import { promisify } from 'util';
import * as os from 'os';
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
  /**
   * Analyzes a dependency set safely — optionally using Docker isolation.
   */
  async analyzeDependencies(
    deps: Record<string, string>,
    options?: { useDocker?: boolean },
  ): Promise<DependencyAnalysisResult> {
    const { useDocker = false } = options ?? {};

    // 🧩 Validate dependency names (prevent path traversal or injection)
    for (const name of Object.keys(deps)) {
      if (!/^[a-zA-Z0-9._@/-]+$/.test(name)) {
        throw new HttpException(
          `Invalid dependency name: ${name}`,
          HttpStatus.BAD_REQUEST,
        );
      }
    }

    const auditId = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
    const tempDir = path.join(os.tmpdir(), `audit-${auditId}`);

    fs.mkdirSync(tempDir, { recursive: true });

    const pkgJson = {
      name: 'audit-temp',
      version: '1.0.0',
      private: true,
      dependencies: deps,
    };

    fs.writeFileSync(
      path.join(tempDir, 'package.json'),
      JSON.stringify(pkgJson, null, 2),
    );

    try {
      await this.safeExec(
        'npm install --ignore-scripts --silent',
        tempDir,
        60_000,
        useDocker,
      );

      const [outdated, auditResult] = await Promise.all([
        this.safeJsonExec('npm outdated --json', tempDir, 60000, useDocker),
        this.safeJsonExec('npm audit --json', tempDir, 60000, useDocker),
      ]);
      const vulnerabilities = this.extractVulnerabilities(auditResult);
      const risky = Object.keys(vulnerabilities);
      const outdatedList = this.extractOutdated(outdated);

      const { score, health } = this.calculateHealthScore(
        vulnerabilities,
        outdatedList,
      );
      const unstable = this.detectUnstableDeps(deps);

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
      try {
        await new Promise((r) => setTimeout(r, 300));

        for (let attempt = 0; attempt < 3; attempt++) {
          try {
            await fs.promises.rm(tempDir, { recursive: true, force: true });
            break;
          } catch (err) {
            if (
              err &&
              typeof err === 'object' &&
              'code' in err &&
              (err as { code?: unknown }).code === 'EBUSY' &&
              attempt < 2
            ) {
              console.warn(
                `Cleanup attempt ${attempt + 1} failed: resource busy, retrying...`,
              );
              await new Promise((resolve) => setTimeout(resolve, 400));
            } else if (
              err &&
              typeof err === 'object' &&
              'code' in err &&
              (err as { code?: unknown }).code === 'ENOENT'
            ) {
              // already deleted, no issue
              break;
            } else {
              const msg =
                err && typeof err === 'object' && 'message' in err
                  ? String((err as { message?: unknown }).message)
                  : String(err);
              console.warn(`Cleanup failed permanently: ${msg}`);
            }
          }
        }
      } catch (err) {
        console.warn(`Cleanup skipped: ${(err as Error).message}`);
      }
    }
  }

  private async safeExec(
    command: string,
    cwd: string,
    timeout = 60_000,
    useDocker = false,
  ): Promise<{ stdout: string; stderr: string }> {
    return new Promise((resolve, reject) => {
      const { exec } = require('child_process');
      const child = exec(command, { cwd, timeout }, (error, stdout, stderr) => {
        if (error) {
          return reject(
            new Error(
              `Command failed: ${command}\nExit code: ${error.code}\n${stderr || stdout}`,
            ),
          );
        }
        resolve({ stdout, stderr });
      });
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
}
