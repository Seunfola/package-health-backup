import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { RepoHealthModule } from './repo-health/repo-health.module';
import { UserProfileModule } from './user-profile/user-profile.module';
import { RepoHealthService } from './repo-health/repo-health/repo-health.service';
import { RepositoryDetailsModule } from './repository-details/repository-details.module';
import { RepositoryDetailsService } from './repository-details/repository-details.service';
import { RepositoryDetailsController } from './repository-details/repository-details.controller';
import { RepoHealthController } from './repo-health/repo-health/repo-health.controller';

@Module({
  imports: [RepoHealthModule, UserProfileModule, RepositoryDetailsModule],
  controllers: [
    AppController,
    RepoHealthController,
    RepositoryDetailsController,
  ],
  providers: [AppService, RepoHealthService, RepositoryDetailsService],
})
export class AppModule {}
