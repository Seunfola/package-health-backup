import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { RepoHealthModule } from './repo-health/repo-health.module';
import { UserProfileModule } from './user-profile/user-profile.module';
import { RepositoryDetailsModule } from './repository-details/repository-details.module';
import * as dotenv from 'dotenv';

// eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
dotenv.config();

@Module({
  imports: [
    MongooseModule.forRoot(process.env.MONGO_URI || ''),
    RepoHealthModule,
    UserProfileModule,
    RepositoryDetailsModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
