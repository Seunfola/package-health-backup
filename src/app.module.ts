import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { RepoHealthModule } from './repo-health/repo-health.module';

@Module({
  imports: [RepoHealthModule],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
