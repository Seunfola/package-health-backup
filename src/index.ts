import { HttpService } from '@nestjs/axios';
import { Model } from 'mongoose';
import { startBackgroundRunner } from './background-runner';
import { RepoHealthService } from './repo-health/repo-health/repo-health.service';
import { DependencyAnalyzerService } from './repo-health/repo-health/dependency-analyzer.service';

let instance: RepoHealthService;

export function startPackageHealth(repoHealthModel: Model<unknown>) {
  if (!instance) {
    // Add an explicit type for repoHealthModel to fix the type error
    instance = new RepoHealthService(
      repoHealthModel as Model<any>,
      new HttpService(),
      new DependencyAnalyzerService(),
    );
  }

  // Auto-run background analysis
  startBackgroundRunner(instance);

  return instance;
}

export { RepoHealthService, DependencyAnalyzerService };
