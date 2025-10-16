import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { NotificationService } from './notification.service';
import { RepoHealthService } from 'src/repo-health/repo-health/repo-health.service';
import { NotificationController } from './notification.controller';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Notification.name, schema: NotificationService },
    ]),
  ],
  providers: [NotificationService, RepoHealthService],
  controllers: [NotificationController],
  exports: [NotificationService],
})
export class NotificationModule {}
