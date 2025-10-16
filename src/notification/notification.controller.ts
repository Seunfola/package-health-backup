import {
  Controller,
  Get,
  Post,
  Param,
  Query,
  Delete,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import { NotificationService } from './notification.service';
import { NotificationSummary } from './notification.interface';
import { NotificationResponseDto } from './notification.model';

@Controller('notifications')
export class NotificationController {
  constructor(private readonly notificationService: NotificationService) {}

  // --- GET ALL ---
  @Get()
  async getNotifications(
    @Query('limit') limit?: string,
    @Query('offset') offset?: string,
    @Query('unreadOnly') unreadOnly?: string,
    @Query('type') type?: import('./notification.interface').NotificationType,
    @Query('priority')
    priority?: import('./notification.interface').NotificationPriority,
  ): Promise<NotificationResponseDto[]> {
    try {
      const parsedLimit = limit ? Number(limit) : undefined;
      const parsedOffset = offset ? Number(offset) : undefined;

      return await this.notificationService.getUserNotifications({
        limit: parsedLimit,
        offset: parsedOffset,
        unreadOnly: unreadOnly === 'true',
        type,
        priority,
      });
    } catch (error: unknown) {
      const message =
        error instanceof Error
          ? error.message
          : 'Failed to fetch notifications';
      throw new HttpException(message, HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  // --- SUMMARY ---
  @Get('summary')
  async getSummary(): Promise<NotificationSummary> {
    try {
      return await this.notificationService.getNotificationSummary();
    } catch (error: unknown) {
      const message =
        error instanceof Error ? error.message : 'Failed to get summary';
      throw new HttpException(message, HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  // --- GENERATE NOTIFICATIONS ---
  @Post('generate/:owner/:repo')
  async generateNotifications(
    @Param('owner') owner: string,
    @Param('repo') repo: string,
  ): Promise<{ generated: number; notifications: NotificationResponseDto[] }> {
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
    } catch (error: unknown) {
      const message =
        error instanceof Error
          ? error.message
          : 'Failed to generate notifications';
      throw new HttpException(message, HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  // --- MARK SINGLE AS READ ---
  @Post(':id/read')
  async markAsRead(@Param('id') id: string): Promise<NotificationResponseDto> {
    try {
      return await this.notificationService.markAsRead(id);
    } catch (error: unknown) {
      const message =
        error instanceof Error ? error.message : 'Notification not found';
      const status =
        error instanceof Error && message.includes('not found')
          ? HttpStatus.NOT_FOUND
          : HttpStatus.BAD_REQUEST;
      throw new HttpException(message, status);
    }
  }

  // --- MARK ALL AS READ ---
  @Post('read-all')
  async markAllAsRead(): Promise<{ modifiedCount: number }> {
    try {
      return await this.notificationService.markAllAsRead();
    } catch (error: unknown) {
      const message =
        error instanceof Error ? error.message : 'Failed to mark all as read';
      throw new HttpException(message, HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  // --- DELETE SINGLE ---
  @Delete(':id')
  async deleteNotification(
    @Param('id') id: string,
  ): Promise<{ message: string }> {
    try {
      await this.notificationService.deleteNotification(id);
      return { message: 'Notification deleted successfully' };
    } catch (error: unknown) {
      const message =
        error instanceof Error ? error.message : 'Notification not found';
      const status =
        error instanceof Error && message.includes('not found')
          ? HttpStatus.NOT_FOUND
          : HttpStatus.BAD_REQUEST;
      throw new HttpException(message, status);
    }
  }

  // --- DELETE ALL ---
  @Delete()
  async clearAllNotifications(): Promise<{ deletedCount: number }> {
    try {
      return await this.notificationService.clearAllNotifications();
    } catch (error: unknown) {
      const message =
        error instanceof Error
          ? error.message
          : 'Failed to clear notifications';
      throw new HttpException(message, HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }
}
