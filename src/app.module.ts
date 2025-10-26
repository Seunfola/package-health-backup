import { Module } from '@nestjs/common';
import { CacheModule } from '@nestjs/cache-manager';
import { ConfigModule } from '@nestjs/config';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { UserProfileModule } from './user-profile/user-profile.module';
import { AuthModule } from './auth/auth.module';
import { DatabaseModule } from './config/database.module';
import { NotificationModule } from './notification/notification.module';
import { UserPreferencesModule } from './preference/preferences.module';
import { RepoHealthModule } from './repo-health/repo-health.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '.env',
    }),

    // Add TTL-based in-memory cache
    CacheModule.register({
      ttl: 60 * 5,
      max: 100,
      isGlobal: true,
    }),

    DatabaseModule,
    RepoHealthModule,
    AuthModule,
    UserProfileModule,
    NotificationModule,
    UserPreferencesModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
