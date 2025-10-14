import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { RepoHealthModule } from './repo-health/repo-health.module';
import { UserProfileModule } from './user-profile/user-profile.module';
import { RepositoryDetailsModule } from './repository-details/repository-details.module';
import * as dotenv from 'dotenv';
import { AuthModule } from './auth/auth.module';

dotenv.config();

if (!process.env.MONGO_URI) {
  throw new Error('MONGO_URI is not defined in your environment variables');
}

@Module({
  imports: [
    // Mongoose setup with updated options
    MongooseModule.forRoot(process.env.MONGO_URI, {
      retryWrites: true,
      serverSelectionTimeoutMS: 5000,
    }),
    RepoHealthModule,
    AuthModule,
    UserProfileModule,
    RepositoryDetailsModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
