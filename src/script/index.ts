import { HttpService } from '@nestjs/axios';
import { Model } from 'mongoose';
import { startBackgroundRunner } from './background-runner';

// Use optional chaining on imports in case files are missing, handle errors gracefully
let RepoHealthService: any;
let DependencyAnalyzerService: any;
try {
  RepoHealthService = require('../src/repo-health/repo-health/repo-health.service').RepoHealthService;
} catch {
  console.error('Could not load RepoHealthService from repo-health.service.');
}
try {
  DependencyAnalyzerService = require('../src/repo-health/repo-health/dependency-analyzer.service').DependencyAnalyzerService;
} catch {
  console.error('Could not load DependencyAnalyzerService from dependency-analyzer.service.');
}

let instance: typeof RepoHealthService extends { new (...args: any[]): infer R } ? R : any;

export function startPackageHealth(repoHealthModel: Model<unknown>) {
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
