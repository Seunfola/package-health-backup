import {
  Controller,
  Get,
  Post,
  Param,
  Query,
  Body,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import { NotificationService } from './notification.service';
import {
  Notification,
  NotificationType,
  NotificationPriority,
  NotificationSummary,
} from './notification.interface';

@Controller('notifications')
export class NotificationController {
  constructor(private readonly notificationService: NotificationService) {}

  @Get()
  async getNotifications(
    @Query('limit') limit?: number,
    @Query('offset') offset?: number,
    @Query('unreadOnly') unreadOnly?: string,
    @Query('type') type?: string,
    @Query('priority') priority?: string,
  ): Promise<Notification[]> {
    try {
      return await this.notificationService.getUserNotifications({
        limit: limit ? Number(limit) : undefined,
        offset: offset ? Number(offset) : undefined,
        unreadOnly: unreadOnly === 'true',
        type: type as NotificationType | undefined,
        priority: priority as NotificationPriority | undefined,
      });
    } catch (error: any) {
      throw new HttpException(
        error instanceof Error && error.message
          ? error.message
          : 'Internal Server Error',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @Get('summary')
  async getSummary(): Promise<NotificationSummary> {
    try {
      return await this.notificationService.getNotificationSummary();
    } catch (error) {
      throw new HttpException(
        error instanceof Error && error.message
          ? error.message
          : 'Internal Server Error',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @Post('generate/:owner/:repo')
  async generateNotifications(
    @Param('owner') owner: string,
    @Param('repo') repo: string,
  ): Promise<{ generated: number; notifications: Notification[] }> {
    try {
      const notifications =
        await this.notificationService.generateNotificationsForRepo(
          owner,
          repo,
        );
      return {
        generated: notifications.length,
        notifications,
      };
    } catch (error: any) {
      throw new HttpException(
        error instanceof Error && error.message
          ? error.message
          : 'Internal Server Error',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @Post(':id/read')
  async markAsRead(@Param('id') id: string): Promise<Notification> {
    try {
      return await this.notificationService.markAsRead(id);
    } catch (error: any) {
      throw new HttpException(
        error instanceof Error && error.message
          ? error.message
          : 'Notification not found',
        HttpStatus.NOT_FOUND,
      );
    }
  }

  @Post('read-all')
  async markAllAsRead(): Promise<{ modifiedCount: number }> {
    try {
      return await this.notificationService.markAllAsRead();
    } catch (error: any) {
      throw new HttpException(
        error instanceof Error && error.message
          ? error.message
          : 'Internal Server Error',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }

    //   @Delete(':id')
    //   async deleteNotification(
    //     @Param('id') id: string,
    //   ): Promise<{ message: string }> {
    //     try {
    //       await this.notificationService.deleteNotification(id);
    //       return { message: 'Notification deleted successfully' };
    //     } catch (error) {
    //       throw new HttpException(error.message, HttpStatus.NOT_FOUND);
    //     }
    //   }

    //   @Delete()
    //   async clearAllNotifications(): Promise<{ deletedCount: number }> {
    //     try {
    //       return await this.notificationService.clearAllNotifications();
    //     } catch (error) {
    //       throw new HttpException(error.message, HttpStatus.INTERNAL_SERVER_ERROR);
    //     }
    //   }
    // }
  }
}
