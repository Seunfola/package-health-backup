import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { MongooseModule } from '@nestjs/mongoose';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { RepoHealthModule } from './repo-health/repo-health.module';
import { UserProfileModule } from './user-profile/user-profile.module';
import { RepositoryDetailsModule } from './repository-details/repository-details.module';
import { AuthModule } from './auth/auth.module';
import { NotificationModule } from './notification/notification.module';

@Module({
  imports: [
    // Load environment variables
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '.env',
    }),

    // MongoDB connection using ConfigService
    MongooseModule.forRootAsync({
      imports: [ConfigModule],
      useFactory: async (configService: ConfigService) => ({
        uri: configService.get<string>('MONGO_URI'),
        retryWrites: true,
        serverSelectionTimeoutMS: 5000,
      }),
      inject: [ConfigService],
    }),

    // Your feature modules
    RepoHealthModule,
    AuthModule,
    UserProfileModule,
    RepositoryDetailsModule,
    NotificationModule
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
