import { HttpException, HttpStatus, Injectable, Logger } from '@nestjs/common';
import AdmZip from 'adm-zip';
import path from 'path';
import semver from 'semver';
import { DependencyAnalyzerService } from '../dependency-analyzer.service';
import { DependencyAnalysisResult } from '../repo-health.interface';

interface ExtendedDependencyMetrics extends DependencyAnalysisResult {
  maintenanceScore: number;
  transitiveRisk: number;
  communityRisk: number;
  securityAuditRisk: number;
}

@Injectable()
export class DependencyAnalysisService {
  private readonly logger = new Logger(DependencyAnalysisService.name);

  constructor(private readonly dependencyAnalyzer: DependencyAnalyzerService) {}

  async analyzeDependencies(
    file?: Express.Multer.File,
    rawJson?: string | Record<string, unknown>,
  ): Promise<ExtendedDependencyMetrics> {
    try {
      const deps = this.resolveDependencies(file, rawJson);

      if (Object.keys(deps).length === 0) {
        this.logger.warn('No dependencies found — returning default analysis.');
        return this.getDefaultDependencyAnalysis();
      }

      const external = await this.dependencyAnalyzer
        .analyzeDependencies(deps)
        .catch((err) => {
          this.logger.warn(
            'External dependency analyzer failed, using internal logic.',
            err,
          );
          return null;
        });

      const computed = await this.computeDeepMetrics(deps, external);
      return computed;
    } catch (error) {
      this.logger.error('Dependency analysis failed:', error);
      return this.getDefaultDependencyAnalysis();
    }
  }

  private resolveDependencies(
    file?: Express.Multer.File,
    rawJson?: string | Record<string, unknown>,
  ): Record<string, string> {
    if (rawJson) return this.extractDependenciesFromJson(rawJson);
    if (file) return this.extractDependenciesFromFile(file);
    return {};
  }

  private extractDependenciesFromJson(
    rawJson: string | Record<string, unknown>,
  ): Record<string, string> {
    const parsed = this.parseJson(rawJson);
    const deps: Record<string, string> = {};

    const collect = (src?: unknown) => {
      if (src && typeof src === 'object' && !Array.isArray(src)) {
        Object.entries(src as Record<string, unknown>).forEach(([pkg, ver]) => {
          if (typeof ver === 'string') deps[pkg] = ver;
        });
      }
    };

    collect(parsed.dependencies);
    collect(parsed.devDependencies);
    return deps;
  }

  private extractDependenciesFromFile(
    file: Express.Multer.File,
  ): Record<string, string> {
    if (this.isZip(file)) {
      const zip = new AdmZip(file.buffer);
      for (const entry of zip.getEntries()) {
        if (!entry.isDirectory && this.isPackageFile(entry.entryName)) {
          const content = entry.getData().toString('utf-8');
          return this.extractDependenciesFromJson(content);
        }
      }
      throw new HttpException(
        'No package files found in zip',
        HttpStatus.BAD_REQUEST,
      );
    }

    if (this.isPackageFile(file.originalname)) {
      const content = file.buffer.toString('utf-8');
      return this.extractDependenciesFromJson(content);
    }

    throw new HttpException('Unsupported file type', HttpStatus.BAD_REQUEST);
  }

  private isZip(file: Express.Multer.File) {
    return (
      file.mimetype === 'application/zip' ||
      file.originalname.toLowerCase().endsWith('.zip')
    );
  }

  private isPackageFile(name: string): boolean {
    const base = path.basename(name).toLowerCase();
    return base === 'package.json' || base === 'package-lock.json';
  }

  private parseJson(
    rawJson: string | Record<string, unknown>,
  ): Record<string, unknown> {
    try {
      const parsed =
        typeof rawJson === 'string' ? JSON.parse(rawJson) : rawJson;
      if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed))
        throw new Error('Invalid JSON structure');
      return parsed as Record<string, unknown>;
    } catch (err) {
      this.logger.error('Invalid JSON input for dependency parsing:', err);
      throw new HttpException('Invalid JSON structure', HttpStatus.BAD_REQUEST);
    }
  }

  /**
   * The heart of the system — deep, heuristic-based dependency analysis
   */
  private async computeDeepMetrics(
    deps: Record<string, string>,
    external?: Partial<DependencyAnalysisResult> | null,
  ): Promise<ExtendedDependencyMetrics> {
    const total = Object.keys(deps).length;
    const risky: string[] = [];
    const licenseRisks: string[] = [];
    let outdatedCount = 0;
    let transitiveRisk = 0;
    let communityRisk = 0;
    let maintenanceScore = 100;
    let securityAuditRisk = 0;

    for (const [pkg, version] of Object.entries(deps)) {
      if (
        semver.validRange(version) &&
        semver.minVersion(version)?.major === 0
      ) {
        risky.push(`${pkg}@${version}`);
      }

      if (
        /[\d]+\.[\d]+\.[\d]+/.test(version) &&
        !version.startsWith('^') &&
        !version.startsWith('~')
      ) {
        outdatedCount++;
      }

      if (
        pkg.toLowerCase().includes('gpl') ||
        pkg.toLowerCase().includes('agpl')
      ) {
        licenseRisks.push(pkg);
      }

      if (pkg.includes('beta') || pkg.includes('alpha')) {
        risky.push(pkg);
      }

      if (pkg.includes('deprecated') || pkg.includes('old')) {
        maintenanceScore -= 10;
      }

      // Community heuristic (small, unknown, or risky org packages)
      if (pkg.startsWith('@internal/') || pkg.startsWith('@private/')) {
        communityRisk += 10;
      }

      // Transitive risks (roughly proportional to dependency count)
      transitiveRisk += Math.min(5, total / 20);
      securityAuditRisk += risky.length * 2;
    }

    const outdatedFactor = outdatedCount / (total || 1);
    const dependencyHealth =
      external?.dependencyHealth ??
      Math.max(
        0,
        100 - outdatedFactor * 50 - risky.length * 3 - transitiveRisk,
      );

    const bundleSize = external?.bundleSize ?? total * 60;
    const popularity =
      external?.popularity ?? Math.max(0, 100 - outdatedCount * 3);
    const daysBehind = outdatedCount * 15;

    return {
      dependencyHealth,
      riskyDependencies: [...(external?.riskyDependencies ?? []), ...risky],
      bundleSize,
      licenseRisks: [...(external?.licenseRisks ?? []), ...licenseRisks],
      popularity,
      daysBehind,
      maintenanceScore,
      transitiveRisk,
      communityRisk,
      securityAuditRisk,
    };
  }

  private getDefaultDependencyAnalysis(): ExtendedDependencyMetrics {
    return {
      dependencyHealth: 100,
      riskyDependencies: [],
      bundleSize: 0,
      licenseRisks: [],
      popularity: 100,
      daysBehind: 0,
      maintenanceScore: 100,
      transitiveRisk: 0,
      communityRisk: 0,
      securityAuditRisk: 0,
    };
  }
}
