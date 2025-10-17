import {
  Controller,
  Get,
  Post,
  Put,
  Param,
  Query,
  Delete,
  Body,
  HttpException,
  HttpStatus,
  UsePipes,
  ValidationPipe,
  UseGuards,
  Request,
} from '@nestjs/common';
import { NotificationService } from './notification.service';
import {
  NotificationResponseDto,
  MarkAllReadResponseDto,
  ClearAllResponseDto,
  BulkOperationResponseDto,
  CreateNotificationDto,
  UpdateNotificationDto,
  NotificationQueryDto,
} from './notification.dto';
import type { NotificationSummary } from './notification.interface';
import { JwtAuthGuard } from 'src/auth/jwt-auth.guard';

@Controller('notifications')
@UsePipes(new ValidationPipe({ transform: true }))
export class NotificationController {
  constructor(private readonly notificationService: NotificationService) {}

  // GET ALL NOTIFICATIONS
  @Get()
  async getNotifications(
    @Query() query: NotificationQueryDto,
  ): Promise<NotificationResponseDto[]> {
    try {
      return await this.notificationService.getUserNotifications(query);
    } catch (error: unknown) {
      const message =
        error instanceof Error
          ? error.message
          : 'Failed to fetch notifications';
      throw new HttpException(message, HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  // GET NOTIFICATION BY ID
  @Get(':id')
  async getNotificationById(
    @Param('id') id: string,
  ): Promise<NotificationResponseDto> {
    try {
      return await this.notificationService.getNotificationById(id);
    } catch (error: unknown) {
      const message =
        error instanceof Error ? error.message : 'Failed to fetch notification';
      const status = message.toLowerCase().includes('not found')
        ? HttpStatus.NOT_FOUND
        : HttpStatus.BAD_REQUEST;
      throw new HttpException(message, status);
    }
  }

  // GET SUMMARY
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

  // GET UNREAD COUNT
  @Get('stats/unread')
  async getUnreadCount(): Promise<{ count: number }> {
    try {
      return await this.notificationService.getUnreadCount();
    } catch (error: unknown) {
      const message =
        error instanceof Error ? error.message : 'Failed to get unread count';
      throw new HttpException(message, HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  // GET NOTIFICATIONS BY REPOSITORY
  @Get('repository/:repository')
  async getNotificationsByRepository(
    @Param('repository') repository: string,
  ): Promise<NotificationResponseDto[]> {
    try {
      return await this.notificationService.getNotificationsByRepository(
        repository,
      );
    } catch (error: unknown) {
      const message =
        error instanceof Error
          ? error.message
          : 'Failed to fetch repository notifications';
      throw new HttpException(message, HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  // SEARCH NOTIFICATIONS
  @Get('search/:term')
  async searchNotifications(
    @Param('term') searchTerm: string,
    @Query() query: NotificationQueryDto,
  ): Promise<NotificationResponseDto[]> {
    try {
      return await this.notificationService.searchNotifications(
        searchTerm,
        query,
      );
    } catch (error: unknown) {
      const message =
        error instanceof Error
          ? error.message
          : 'Failed to search notifications';
      throw new HttpException(message, HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  // CREATE NOTIFICATION
  @Post()
  async createNotification(
    @Body() createNotificationDto: CreateNotificationDto,
  ): Promise<NotificationResponseDto> {
    try {
      return await this.notificationService.createNotification(
        createNotificationDto,
      );
    } catch (error: unknown) {
      const message =
        error instanceof Error
          ? error.message
          : 'Failed to create notification';
      throw new HttpException(message, HttpStatus.BAD_REQUEST);
    }
  }

  // GENERATE NOTIFICATIONS
  @Post('generate/:owner/:repo')
  @UseGuards(JwtAuthGuard)
  async generateNotifications(
    @Param('owner') owner: string,
    @Param('repo') repo: string,
    @Request() req,
  ): Promise<{ generated: number; notifications: NotificationResponseDto[] }> {
    try {
      const notifications =
        await this.notificationService.generateNotificationsForRepo(
          owner,
          repo,
          (req as { user?: { id?: string } }).user?.id,
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

  // MARK SINGLE AS READ
  @Post(':id/read')
  async markAsRead(@Param('id') id: string): Promise<NotificationResponseDto> {
    try {
      const notification = await this.notificationService.markAsRead(id);
      if (!notification) {
        throw new HttpException('Notification not found', HttpStatus.NOT_FOUND);
      }
      return notification;
    } catch (error: unknown) {
      const message =
        error instanceof Error ? error.message : 'Notification not found';
      const status = message.toLowerCase().includes('not found')
        ? HttpStatus.NOT_FOUND
        : HttpStatus.BAD_REQUEST;
      throw new HttpException(message, status);
    }
  }

  // MARK MULTIPLE AS READ
  @Post('mark-read')
  async markMultipleAsRead(
    @Body() body: { notificationIds: string[] },
  ): Promise<BulkOperationResponseDto> {
    try {
      return await this.notificationService.markMultipleAsRead(
        body.notificationIds,
      );
    } catch (error: unknown) {
      const message =
        error instanceof Error
          ? error.message
          : 'Failed to mark notifications as read';
      throw new HttpException(message, HttpStatus.BAD_REQUEST);
    }
  }

  // MARK ALL AS READ
  @Post('read-all')
  async markAllAsRead(): Promise<MarkAllReadResponseDto> {
    try {
      return await this.notificationService.markAllAsRead();
    } catch (error: unknown) {
      const message =
        error instanceof Error ? error.message : 'Failed to mark all as read';
      throw new HttpException(message, HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  // UPDATE NOTIFICATION
  @Put(':id')
  async updateNotification(
    @Param('id') id: string,
    @Body() updateNotificationDto: UpdateNotificationDto,
  ): Promise<NotificationResponseDto> {
    try {
      return await this.notificationService.updateNotification(
        id,
        updateNotificationDto,
      );
    } catch (error: unknown) {
      const message =
        error instanceof Error
          ? error.message
          : 'Failed to update notification';
      const status = message.toLowerCase().includes('not found')
        ? HttpStatus.NOT_FOUND
        : HttpStatus.BAD_REQUEST;
      throw new HttpException(message, status);
    }
  }

  // DELETE SINGLE
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
      const status = message.includes('not found')
        ? HttpStatus.NOT_FOUND
        : HttpStatus.BAD_REQUEST;
      throw new HttpException(message, status);
    }
  }

  // DELETE MULTIPLE
  @Delete('bulk/delete')
  async deleteMultipleNotifications(
    @Body() body: { notificationIds: string[] },
  ): Promise<BulkOperationResponseDto> {
    try {
      return await this.notificationService.deleteMultipleNotifications(
        body.notificationIds,
      );
    } catch (error: unknown) {
      const message =
        error instanceof Error
          ? error.message
          : 'Failed to delete notifications';
      throw new HttpException(message, HttpStatus.BAD_REQUEST);
    }
  }

  // DELETE ALL
  @Delete()
  async clearAllNotifications(): Promise<ClearAllResponseDto> {
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

  // CLEANUP OLD NOTIFICATIONS
  @Post('cleanup')
  async cleanupOldNotifications(
    @Query('days') days?: string,
  ): Promise<{ deletedCount: number }> {
    try {
      const daysOld = days ? parseInt(days, 10) : 30;
      return await this.notificationService.cleanupOldNotifications(daysOld);
    } catch (error: unknown) {
      const message =
        error instanceof Error
          ? error.message
          : 'Failed to cleanup notifications';
      throw new HttpException(message, HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }
}
