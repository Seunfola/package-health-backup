import { Module } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { MongooseModule } from '@nestjs/mongoose';
import { RepoHealthController } from './repo-health/repo-health.controller';
import { RepoHealthService } from './repo-health/repo-health.service';
import { RepoHealth, RepoHealthSchema } from './repo-health/repo-health.model';
import { DependencyAnalyzerService } from './repo-health/dependency-analyzer.service';

@Module({
  imports: [
    HttpModule,
    MongooseModule.forFeature([
      { name: RepoHealth.name, schema: RepoHealthSchema },
    ]),
  ],
  controllers: [RepoHealthController],
  providers: [RepoHealthService, DependencyAnalyzerService],
})
export class RepoHealthModule {}
