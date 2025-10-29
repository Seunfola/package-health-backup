import { Injectable, HttpException, HttpStatus } from '@nestjs/common';
import { exec } from 'child_process';
import * as fs from 'fs';
import { promisify } from 'util';
import AdmZip from 'adm-zip';

const execAsync = promisify(exec);

interface DependencyAnalysisResult {
  // keep original fields
  score: number;
  health: string;
  totalVulns: number;
  totalOutdated: number;
  risky: string[];
  vulnerabilities: Record<string, { severity: string; via: string[] }>;
  outdated: { name: string; current: string; latest: string }[];
  unstable: string[];
  bundleSize: number;
  licenseRisks: string[];
  popularity: number;
  daysBehind?: number;
  // aliases for compatibility
  dependencyHealth?: number;
  riskyDependencies?: string[];
}

@Injectable()
export class DependencyAnalyzerService {
  async analyzeDependencies(
    input?: Record<string, unknown> | string | Express.Multer.File,
  ): Promise<DependencyAnalysisResult> {
    try {
      let deps: Record<string, string> = {};

      // No input -> default healthy
      if (!input) {
        return this.defaultResult();
      }

      // If raw JSON string
      if (typeof input === 'string') {
        const parsed = this.safeParseJSON(input, 'Invalid JSON input');
        deps = this.extractDepsFromPackageJson(parsed);
      }
      // If multer file
      else if (input && typeof input === 'object' && 'buffer' in input) {
        const file = input as Express.Multer.File;
        if (
          !file.originalname ||
          !file.originalname.toLowerCase().endsWith('.json')
        ) {
          throw new HttpException(
            'Unsupported file type',
            HttpStatus.BAD_REQUEST,
          );
        }
        const raw = file.buffer.toString('utf8');
        const parsed = this.safeParseJSON(raw, 'Invalid JSON input');
        deps = this.extractDepsFromPackageJson(parsed);
      }
      // If already an object (maybe a merged deps map)
      else if (typeof input === 'object') {
        // If the caller passed a package.json-like object
        deps = this.extractDepsFromPackageJson(
          input as Record<string, unknown>,
        );
        // if empty, try interpreting the object itself as deps map (backwards compatibility)
        if (Object.keys(deps).length === 0) {
          // cast but ensure values are strings
          deps = Object.entries(input as Record<string, unknown>)
            .filter(([, v]) => typeof v === 'string')
            .reduce(
              (acc, [k, v]) => {
                acc[k] = v as string;
                return acc;
              },
              {} as Record<string, string>,
            );
        }
      }

      // Validate package names (allow scopes and plus)
      const depKeys = Object.keys(deps);
      for (const name of depKeys) {
        if (!/^[a-zA-Z0-9.+_@\/-]+$/.test(name)) {
          throw new HttpException(
            `Invalid dependency name: ${name}`,
            HttpStatus.BAD_REQUEST,
          );
        }
      }

      const topDeps = depKeys.slice(0, 5);
      const [githubVulns, npmData] = await Promise.all([
        this.getGitHubAdvisories(topDeps),
        this.getNpmBatch(topDeps),
      ]);

      const vulnerabilities = this.extractVulnerabilitiesFromGitHub(
        githubVulns,
        deps,
      );
      const risky = Object.keys(vulnerabilities);
      const outdatedList = this.extractOutdated(npmData, deps);
      const { score, health } = this.calculateHealthScore(
        vulnerabilities,
        outdatedList,
      );
      const unstable = this.detectUnstableDeps(deps);

      const result = {
        score,
        health,
        totalVulns: Object.keys(vulnerabilities).length,
        totalOutdated: outdatedList.length,
        risky,
        vulnerabilities,
        outdated: outdatedList,
        unstable,
        bundleSize: await this.getRealBundleSize(topDeps),
        licenseRisks: this.getRealLicenseRisks(npmData),
        popularity: await this.getRealPopularity(topDeps),
        daysBehind: await this.getDaysBehind(outdatedList),
      } as DependencyAnalysisResult;

      // --- Compatibility aliases used by other layers/tests ---
      result.dependencyHealth = result.score;
      result.riskyDependencies = result.risky;

      return result;
    } catch (error) {
      if (error instanceof HttpException) throw error;
      throw new HttpException(
        (error as any)?.message || 'Dependency analysis failed',
        HttpStatus.BAD_REQUEST,
      );
    }
  }

  // ---------------- helpers ----------------

  private defaultResult(): DependencyAnalysisResult {
    return {
      score: 100,
      health: 'healthy',
      totalVulns: 0,
      totalOutdated: 0,
      risky: [],
      vulnerabilities: {},
      outdated: [],
      unstable: [],
      bundleSize: 0,
      licenseRisks: [],
      popularity: 0,
      daysBehind: 0,
      dependencyHealth: 100,
      riskyDependencies: [],
    };
  }

  private safeParseJSON(
    raw: string,
    errMsg = 'Invalid JSON',
  ): Record<string, unknown> {
    try {
      const parsed = JSON.parse(raw);
      if (!parsed || typeof parsed !== 'object') throw new Error();
      return parsed as Record<string, unknown>;
    } catch {
      throw new HttpException(errMsg, HttpStatus.BAD_REQUEST);
    }
  }

  /** Extract dependencies/devDependencies/optionalDependencies and merge them */
  private extractDepsFromPackageJson(
    parsed: Record<string, unknown>,
  ): Record<string, string> {
    const out: Record<string, string> = {};
    if (!parsed || typeof parsed !== 'object') return out;

    const maybe = (k: string) => {
      const v = (parsed as any)[k];
      if (v && typeof v === 'object') {
        Object.entries(v).forEach(([name, ver]) => {
          if (typeof ver === 'string') out[name] = ver;
        });
      }
    };

    // common sections
    maybe('dependencies');
    maybe('devDependencies');
    maybe('optionalDependencies');
    maybe('peerDependencies');

    return out;
  }

  private normalizeVersion(v: string): string {
    if (!v || typeof v !== 'string') return '0.0.0';
    let cleaned = v.trim();
    cleaned = cleaned.replace(/^[~^><=*\s]+/, '');
    const match = cleaned.match(/(\d+\.\d+\.\d+)|(\d+\.\d+)/);
    if (match) return match[0];
    // fallback to digits
    const digits = cleaned.match(/\d+/g);
    if (digits && digits.length) return digits.join('.');
    return '0.0.0';
  }

  private semverMatch(version: string, range: string): boolean {
    try {
      const v = this.normalizeVersion(version);
      const r = String(range || '');
      const [vMaj] = v.split('.');
      const majInRange = r.match(/\d+/);
      if (majInRange) {
        return String(majInRange[0]) === String(vMaj);
      }
      return r.includes(vMaj);
    } catch {
      return false;
    }
  }

  private isOutdated(current: string, latest: string): boolean {
    if (!latest || latest === 'unknown') return false;
    const cur = this.normalizeVersion(current);
    const lat = this.normalizeVersion(latest);
    const [cMajor] = cur.split('.');
    const [lMajor] = lat.split('.');
    const cM = parseInt(cMajor || '0', 10);
    const lM = parseInt(lMajor || '0', 10);
    return Number.isFinite(lM) && lM > cM;
  }

  private detectUnstableDeps(deps: Record<string, string>) {
    return Object.entries(deps)
      .filter(([, version]) =>
        /alpha|beta|rc|snapshot|next/i.test(String(version)),
      )
      .map(([pkg]) => pkg);
  }

  private extractVulnerabilitiesFromGitHub(
    advisories: any[],
    deps: Record<string, string>,
  ) {
    const result: Record<string, { severity: string; via: string[] }> = {};
    if (!Array.isArray(advisories)) return result;
    Object.entries(deps)
      .slice(0, 5)
      .forEach(([name, version]) => {
        const pkgVulns = advisories.filter(
          (adv: any) =>
            adv?.package_name === name &&
            this.semverMatch(
              String(version || ''),
              String(adv?.affected_range ?? ''),
            ),
        );
        if (pkgVulns.length) {
          const first = pkgVulns[0] || {};
          const severity =
            typeof first.severity === 'string' ? first.severity : 'high';
          const title =
            typeof first.title === 'string'
              ? first.title
              : first.ghsa_id
                ? `GHSA-${first.ghsa_id}`
                : 'Unknown vulnerability';
          result[name] = { severity, via: [title] };
        }
      });
    return result;
  }

  private extractOutdated(
    npmData: Record<
      string,
      { 'dist-tags'?: { latest: string }; version?: string }
    >,
    deps: Record<string, string>,
  ): { name: string; current: string; latest: string }[] {
    const list: { name: string; current: string; latest: string }[] = [];

    Object.entries(deps)
      .slice(0, 5)
      .forEach(([name, current]) => {
        const pkgData = npmData?.[name];
        const latest =
          pkgData?.['dist-tags']?.latest ?? pkgData?.version ?? 'unknown';
        if (this.isOutdated(String(current || '0.0.0'), String(latest))) {
          list.push({ name, current: String(current), latest: String(latest) });
        }
      });

    return list;
  }

  private calculateHealthScore(
    vulnerabilities: Record<string, any>,
    outdated: any[],
  ) {
    const totalVulns = Object.keys(vulnerabilities || {}).length;
    const totalOutdated = Array.isArray(outdated) ? outdated.length : 0;
    const score = Math.max(
      0,
      Math.round(100 - totalVulns * 5 - totalOutdated * 1.5),
    );
    let health = 'Excellent';
    if (score < 80) health = 'Good';
    if (score < 60) health = 'Moderate';
    if (score < 40) health = 'Poor';
    return { score, health, totalVulns, totalOutdated };
  }

  private async getRealBundleSize(packageNames: string[]) {
    if (!Array.isArray(packageNames) || packageNames.length === 0) return 0;
    const fetchFn: typeof fetch | undefined =
      (globalThis as any).fetch ?? undefined;
    if (!fetchFn) {
      return packageNames.length * 125;
    }
    const sizes = await Promise.all(
      packageNames.map(async (name) => {
        try {
          const url = `https://bundlephobia.com/api/size?package=${encodeURIComponent(name)}`;
          const res = await fetchFn(url);
          const data = (await res.json()) as { gzip?: number };
          if (
            typeof data?.gzip === 'number' &&
            isFinite(data.gzip) &&
            data.gzip > 0
          )
            return data.gzip;
          return 125;
        } catch {
          return 125;
        }
      }),
    );
    return Math.round(sizes.reduce((a, b) => a + b, 0));
  }

  private getRealLicenseRisks(npmData: Record<string, any>) {
    const risks: string[] = [];
    Object.entries(npmData || {}).forEach(([name, data]) => {
      const license =
        data && typeof data === 'object' && typeof data.license === 'string'
          ? data.license
          : undefined;
      if (license && ['GPL-3.0', 'AGPL', 'CPOL'].includes(license))
        risks.push(`${name}: ${license}`);
    });
    return risks;
  }

  private async getRealPopularity(packageNames: string[]) {
    const fetchFn: typeof fetch | undefined =
      (globalThis as any).fetch ?? undefined;
    if (!fetchFn)
      return Math.min(100, Math.round((packageNames.length * 5000) / 10000));
    try {
      const downloads = await Promise.all(
        packageNames.map(async (name) => {
          try {
            const res = await fetchFn(
              `https://api.npmjs.org/downloads/point/last-month/${encodeURIComponent(name)}`,
            );
            const data: any = await res.json();
            if (
              data &&
              typeof data.downloads === 'number' &&
              isFinite(data.downloads)
            )
              return data.downloads || 5000;
            return 5000;
          } catch {
            return 5000;
          }
        }),
      );
      const total = downloads.reduce((a, b) => a + b, 0);
      return Math.min(100, Math.round(total / 10000));
    } catch {
      return 0;
    }
  }

  private async getDaysBehind(
    outdated: { name: string; current: string; latest: string }[],
  ) {
    if (!Array.isArray(outdated) || outdated.length === 0) return 0;
    const fetchFn: typeof fetch | undefined =
      (globalThis as any).fetch ?? undefined;
    if (!fetchFn) return 30;

    const daysList = await Promise.all(
      outdated.map(async ({ name, latest }) => {
        try {
          const res = await fetchFn(
            `https://registry.npmjs.org/${encodeURIComponent(name)}`,
          );
          if (!res.ok) return 30;
          const data: any = await res.json();
          const time = data?.time;
          if (
            time &&
            typeof time === 'object' &&
            typeof time[latest] === 'string'
          ) {
            return Math.round(
              (Date.now() - new Date(time[latest]).getTime()) /
                (1000 * 60 * 60 * 24),
            );
          }
        } catch {
          // ignore
        }
        return 30;
      }),
    );

    return Math.round(daysList.reduce((a, b) => a + b, 0) / daysList.length);
  }

  private async getNpmBatch(packageNames: string[]) {
    const fetchFn: typeof fetch | undefined =
      (globalThis as any).fetch ?? undefined;
    if (!fetchFn) return {};

    const requests = packageNames.map(async (name) => {
      try {
        const response = await fetchFn(
          `https://registry.npmjs.org/${encodeURIComponent(name)}`,
        );
        if (!response.ok)
          throw new Error(`Failed to fetch ${name}: ${response.statusText}`);
        const data = await response.json();
        return { data };
      } catch (err) {
        return { error: err };
      }
    });

    const results = await Promise.all(requests);
    const out: Record<
      string,
      { 'dist-tags'?: { latest: string }; version?: string }
    > = {};
    results.forEach((r, i) => {
      if (r && 'data' in r && r.data && typeof r.data === 'object')
        out[packageNames[i]] = r.data;
    });
    return out;
  }

  private async getGitHubAdvisories(packageNames: string[]) {
    const fetchFn: typeof fetch | undefined =
      (globalThis as any).fetch ?? undefined;
    if (!fetchFn) return [];
    try {
      const url = `https://api.github.com/advisories?filter=${encodeURIComponent(packageNames.join(','))}`;
      const response = await fetchFn(url);
      if (!response.ok) return [];
      const advisories = await response.json();
      if (!Array.isArray(advisories)) return [];
      return advisories;
    } catch {
      return [];
    }
  }

  private extractVulnerabilities(auditJson: Record<string, unknown>) {
    const result: Record<string, { severity: string; via: string[] }> = {};
    let vulns: Record<string, unknown> = {};
    if (auditJson && typeof auditJson === 'object') {
      if (
        'vulnerabilities' in auditJson &&
        typeof (auditJson as any).vulnerabilities === 'object'
      ) {
        vulns = (auditJson as any).vulnerabilities;
      } else if (
        'advisories' in auditJson &&
        typeof (auditJson as any).advisories === 'object'
      ) {
        vulns = (auditJson as any).advisories;
      }
    }
    for (const [pkg, data] of Object.entries(vulns)) {
      if (!data || typeof data !== 'object') continue;
      const via: string[] = Array.isArray((data as any).via)
        ? (data as any).via
            .map((v: any) => (typeof v === 'string' ? v : (v?.title ?? '')))
            .filter((s: string) => !!s)
        : [];
      const severity =
        typeof (data as any).severity === 'string'
          ? (data as any).severity
          : 'info';
      result[pkg] = { severity, via };
    }
    return result;
  }
}
