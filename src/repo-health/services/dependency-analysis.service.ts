import { HttpException, HttpStatus, Injectable, Logger } from '@nestjs/common';
import AdmZip from 'adm-zip';
import path from 'path';
import { DependencyAnalyzerService } from '../dependency-analyzer.service';
import { DependencyAnalysisResult } from '../repo-health.interface';


@Injectable()
export class DependencyAnalysisService {
  private readonly logger = new Logger(DependencyAnalysisService.name);

  constructor(private readonly dependencyAnalyzer: DependencyAnalyzerService) {}

  async analyzeDependencies(
    file?: Express.Multer.File,
    rawJson?: string | Record<string, unknown>,
  ): Promise<DependencyAnalysisResult> {
    let deps: Record<string, string> = {};

    try {
      if (rawJson) {
        deps = this.extractDependenciesFromJson(rawJson);
      } else if (file) {
        deps = this.extractDependenciesFromFile(file);
      }

      if (Object.keys(deps).length === 0) {
        return this.getDefaultDependencyAnalysis();
      }

      const analysis = await this.dependencyAnalyzer.analyzeDependencies(deps);
      return {
        dependencyHealth: analysis?.score ?? 100,
        riskyDependencies: analysis?.risky ?? [],
        bundleSize: analysis?.bundleSize ?? 0,
        licenseRisks: analysis?.licenseRisks ?? [],
        popularity: analysis?.popularity ?? 0,
        daysBehind: analysis?.daysBehind ?? 0,
      };
    } catch (error) {
      this.logger.error('Dependency analysis failed:', error);
      return this.getDefaultDependencyAnalysis();
    }
  }

  private extractDependenciesFromJson(
    rawJson: string | Record<string, unknown>,
  ): Record<string, string> {
    const parsed = this.parseJson(rawJson);
    const deps: Record<string, string> = {};

    const extract = (source: unknown) => {
      if (typeof source === 'object' && source !== null) {
        Object.entries(source as Record<string, unknown>).forEach(
          ([key, value]) => {
            if (typeof value === 'string') deps[key] = value;
          },
        );
      }
    };

    extract(parsed.dependencies);
    extract(parsed.devDependencies);
    return deps;
  }

  private extractDependenciesFromFile(
    file: Express.Multer.File,
  ): Record<string, string> {
    if (
      file.mimetype === 'application/zip' ||
      file.originalname.endsWith('.zip')
    ) {
      const zip = new AdmZip(file.buffer);
      const entries = zip.getEntries();

      for (const entry of entries) {
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

  private isPackageFile(filename: string): boolean {
    const baseName = path.basename(filename).toLowerCase();
    return baseName === 'package.json' || baseName === 'package-lock.json';
  }

  private parseJson(
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
}
