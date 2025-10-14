import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { RepoHealthModule } from './repo-health/repo-health.module';
import { UserProfileController } from './user-profile/user-profile.controller';
import { UserProfileModule } from './user-profile/user-profile.module';

@Module({
  imports: [RepoHealthModule, UserProfileModule],
  controllers: [AppController, UserProfileController],
  providers: [AppService],
})
export class AppModule {}
