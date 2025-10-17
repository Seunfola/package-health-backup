import { HttpService } from '@nestjs/axios';
import { Model } from 'mongoose';
import { startBackgroundRunner } from './background-runner';
import { RepoHealthService } from '../src/repo-health/repo-health/repo-health.service';
import { DependencyAnalyzerService } from '../src/repo-health/repo-health/dependency-analyzer.service';

let instance: RepoHealthService;

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
