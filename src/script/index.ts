import { HttpService } from '@nestjs/axios';
import { Model } from 'mongoose';
import { startBackgroundRunner } from './background-runner';

// Use try-catch on dynamic imports in case files are missing
let RepoHealthService: any;
let DependencyAnalyzerService: any;
try {
  RepoHealthService =
    require('../repo-health/repo-health/repo-health.service').RepoHealthService;
} catch {
  console.error('Could not load RepoHealthService from repo-health.service.');
}
try {
  DependencyAnalyzerService =
    require('../repo-health/repo-health/dependency-analyzer.service').DependencyAnalyzerService;
} catch {
  console.error('Could not load DependencyAnalyzerService from dependency-analyzer.service.');
}

export function startPackageHealth(repoHealthModel: Model<unknown>) {
  if (!RepoHealthService || !DependencyAnalyzerService) {
    throw new Error('Required services not loaded. Cannot start package health.');
  }

  // Use a scoped instance variable instead of undeclared 'instance'
  let instance;
  if (!instance) {
    instance = new RepoHealthService(
      // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
      repoHealthModel as Model<any>,
      new HttpService(),
      new DependencyAnalyzerService(),
    );
  }

  startBackgroundRunner(instance);

  return instance;
}

export { RepoHealthService, DependencyAnalyzerService };
