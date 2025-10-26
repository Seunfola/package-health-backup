import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { HttpModule } from '@nestjs/axios';
import { RepoHealthController } from './repo-health.controller';
import { GithubApiService } from './services/github-api.service';
import { DependencyAnalysisService } from './services/dependency-analysis.service';
import { HealthCalculatorService } from './services/health-calculator.service';
import { RepositoryDataService } from './services/repository-data.service';
import { DependencyAnalyzerService } from './dependency-analyzer.service';
import { RepoHealth, RepoHealthSchema } from './repo-health.model';
import { RepoHealthService } from './services/repo-health.service';


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
