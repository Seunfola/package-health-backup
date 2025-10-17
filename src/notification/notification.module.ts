import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { NotificationService } from './notification.service';
import { RepoHealthService } from 'src/repo-health/repo-health/repo-health.service';
import { NotificationController } from './notification.controller';
import { HttpModule } from '@nestjs/axios';
import { Schema } from 'mongoose';

const NotificationSchema = new Schema({});

@Module({
  imports: [
    HttpModule,
    MongooseModule.forFeature([
      {
        name: 'Notification',
        schema: NotificationSchema,
      },
    ]),
  ],
  providers: [NotificationService, RepoHealthService],
  controllers: [NotificationController],
})
export class NotificationModule {}
