import { Module } from '@nestjs/common';
import { RepoHealthService } from './repo-health/repo-health.service';
import { RepoHealthController } from './repo-health/repo-health.controller';

@Module({
  providers: [RepoHealthService],
  controllers: [RepoHealthController]
})
export class RepoHealthModule {}
