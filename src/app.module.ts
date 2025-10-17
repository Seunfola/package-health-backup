import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { RepoHealthModule } from './repo-health/repo-health.module';
import { UserProfileModule } from './user-profile/user-profile.module';
import { RepositoryDetailsModule } from './repository-details/repository-details.module';
import { AuthModule } from './auth/auth.module';
import { DatabaseModule } from './config/database.module';
import { NotificationModule } from './notification/notification.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '.env',
    }),

    DatabaseModule,

    RepoHealthModule,
    AuthModule,
    UserProfileModule,
    RepositoryDetailsModule,
    NotificationModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
