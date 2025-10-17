import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { NotificationService } from './notification.service';
import { NotificationController } from './notification.controller';
import { NotificationSchema } from './notification.model';
import { RepoHealthModule } from '../repo-health/repo-health.module';
@Module({
  imports: [
    MongooseModule.forFeature([
      {
        name: 'Notification',
        schema: NotificationSchema,
      },
    ]),
    RepoHealthModule,
  ],
  providers: [NotificationService],
  controllers: [NotificationController],
})
export class NotificationModule {}
