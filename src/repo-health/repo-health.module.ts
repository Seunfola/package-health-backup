import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { HttpModule } from '@nestjs/axios';
import { RepoHealthController } from './repo-health/repo-health.controller';
import { RepoHealthService } from './repo-health/repo-health.service';
import { GithubApiService } from './repo-health/services/github-api.service';
import { DependencyAnalysisService } from './repo-health/services/dependency-analysis.service';
import { HealthCalculatorService } from './repo-health/services/health-calculator.service';
import { RepositoryDataService } from './repo-health/services/repository-data.service';
import { DependencyAnalyzerService } from './repo-health/dependency-analyzer.service';
import { RepoHealth, RepoHealthSchema } from './repo-health/repo-health.model';


@Module({
  imports: [
    HttpModule,
    MongooseModule.forFeature([
      { name: RepoHealth.name, schema: RepoHealthSchema },
    ]),
  ],
  controllers: [RepoHealthController],
  providers: [
    RepoHealthService,
    GithubApiService,
    DependencyAnalysisService,
    HealthCalculatorService,
    RepositoryDataService,
    DependencyAnalyzerService,
  ],
  exports: [RepoHealthService],
})
export class RepoHealthModule {}
