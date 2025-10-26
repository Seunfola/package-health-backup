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
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiParam,
  ApiQuery,
  ApiBody,
  ApiBearerAuth,
} from '@nestjs/swagger';
import { NotificationService } from './notification.service';
import {
  NotificationResponseDto,
  MarkAllReadResponseDto,
  ClearAllResponseDto,
  BulkOperationResponseDto,
  CreateNotificationDto,
  UpdateNotificationDto,
  NotificationQueryDto,
  NotificationSummaryResponseDto,
  BulkDeleteNotificationsDto,
} from './notification.dto';
import type { NotificationSummary } from './notification.interface';
import { JwtAuthGuard } from 'src/auth/jwt-auth.guard';

@Controller('notifications')
@ApiTags('notifications')
@UsePipes(new ValidationPipe({ transform: true }))
export class NotificationController {
  constructor(private readonly notificationService: NotificationService) {}

  // GET ALL NOTIFICATIONS
  @Get()
  @ApiOperation({
    summary: 'Get all notifications',
    description: 'Retrieve notifications with filtering and pagination',
  })
  @ApiResponse({
    status: 200,
    description: 'Notifications retrieved successfully',
    type: [NotificationResponseDto],
  })
  @ApiResponse({ status: 500, description: 'Internal server error' })
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
  @ApiOperation({ summary: 'Get notification by ID' })
  @ApiParam({ name: 'id', description: 'Notification ID' })
  @ApiResponse({
    status: 200,
    description: 'Notification retrieved successfully',
    type: NotificationResponseDto,
  })
  @ApiResponse({ status: 404, description: 'Notification not found' })
  @ApiResponse({ status: 400, description: 'Invalid notification ID' })
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
  @ApiOperation({ summary: 'Get notification summary' })
  @ApiResponse({
    status: 200,
    description: 'Summary retrieved successfully',
    type: NotificationSummaryResponseDto,
  })
  @ApiResponse({ status: 500, description: 'Internal server error' })
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
  @ApiOperation({ summary: 'Get unread notifications count' })
  @ApiResponse({
    status: 200,
    description: 'Unread count retrieved successfully',
    schema: { type: 'object', properties: { count: { type: 'number' } } },
  })
  @ApiResponse({ status: 500, description: 'Internal server error' })
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
  @ApiOperation({ summary: 'Get notifications by repository' })
  @ApiParam({
    name: 'repository',
    description: 'Repository in format "owner/repo"',
    example: 'nestjs/nest',
  })
  @ApiResponse({
    status: 200,
    description: 'Repository notifications retrieved successfully',
    type: [NotificationResponseDto],
  })
  @ApiResponse({ status: 500, description: 'Internal server error' })
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
  @ApiOperation({ summary: 'Search notifications' })
  @ApiParam({ name: 'term', description: 'Search term' })
  @ApiResponse({
    status: 200,
    description: 'Search results retrieved successfully',
    type: [NotificationResponseDto],
  })
  @ApiResponse({ status: 500, description: 'Internal server error' })
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
  @ApiOperation({ summary: 'Create a new notification' })
  @ApiBody({ type: CreateNotificationDto })
  @ApiResponse({
    status: 201,
    description: 'Notification created successfully',
    type: NotificationResponseDto,
  })
  @ApiResponse({ status: 400, description: 'Invalid notification data' })
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
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Generate notifications for repository',
    description: 'Generate health and security notifications for a repository',
  })
  @ApiParam({ name: 'owner', description: 'Repository owner' })
  @ApiParam({ name: 'repo', description: 'Repository name' })
  @ApiResponse({
    status: 201,
    description: 'Notifications generated successfully',
    schema: {
      type: 'object',
      properties: {
        generated: { type: 'number' },
        notifications: {
          type: 'array',
          items: { $ref: '#/components/schemas/NotificationResponseDto' },
        },
      },
    },
  })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 500, description: 'Internal server error' })
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
  @ApiOperation({ summary: 'Mark notification as read' })
  @ApiParam({ name: 'id', description: 'Notification ID' })
  @ApiResponse({
    status: 200,
    description: 'Notification marked as read',
    type: NotificationResponseDto,
  })
  @ApiResponse({ status: 404, description: 'Notification not found' })
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
  @ApiOperation({ summary: 'Mark multiple notifications as read' })
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        notificationIds: {
          type: 'array',
          items: { type: 'string' },
          example: ['id1', 'id2', 'id3'],
        },
      },
      required: ['notificationIds'],
    },
  })
  @ApiResponse({
    status: 200,
    description: 'Notifications marked as read',
    type: BulkOperationResponseDto,
  })
  @ApiResponse({ status: 400, description: 'Invalid notification IDs' })
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
  @ApiOperation({ summary: 'Mark all notifications as read' })
  @ApiResponse({
    status: 200,
    description: 'All notifications marked as read',
    type: MarkAllReadResponseDto,
  })
  @ApiResponse({ status: 500, description: 'Internal server error' })
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
  @ApiOperation({ summary: 'Update notification' })
  @ApiParam({ name: 'id', description: 'Notification ID' })
  @ApiBody({ type: UpdateNotificationDto })
  @ApiResponse({
    status: 200,
    description: 'Notification updated successfully',
    type: NotificationResponseDto,
  })
  @ApiResponse({ status: 404, description: 'Notification not found' })
  @ApiResponse({ status: 400, description: 'Invalid update data' })
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
  @ApiOperation({ summary: 'Delete notification' })
  @ApiParam({ name: 'id', description: 'Notification ID' })
  @ApiResponse({
    status: 200,
    description: 'Notification deleted successfully',
    schema: { type: 'object', properties: { message: { type: 'string' } } },
  })
  @ApiResponse({ status: 404, description: 'Notification not found' })
  @ApiResponse({ status: 400, description: 'Invalid notification ID' })
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
  @ApiOperation({ summary: 'Delete multiple notifications' })
  @ApiBody({ type: BulkDeleteNotificationsDto })
  @ApiResponse({
    status: 200,
    description: 'Notifications deleted successfully',
    type: BulkOperationResponseDto,
  })
  @ApiResponse({ status: 400, description: 'Invalid notification IDs' })
  async deleteMultipleNotifications(
    @Body() body: BulkDeleteNotificationsDto,
  ): Promise<BulkOperationResponseDto> {
    try {
      return await this.notificationService.deleteMultipleNotifications(
        body.ids,
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
  @ApiOperation({ summary: 'Delete all notifications' })
  @ApiResponse({
    status: 200,
    description: 'All notifications deleted successfully',
    type: ClearAllResponseDto,
  })
  @ApiResponse({ status: 500, description: 'Internal server error' })
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
  @ApiOperation({
    summary: 'Cleanup old notifications',
    description:
      'Delete notifications older than specified days (default: 30 days)',
  })
  @ApiQuery({
    name: 'days',
    required: false,
    type: Number,
    description: 'Number of days (default: 30)',
  })
  @ApiResponse({
    status: 200,
    description: 'Cleanup completed successfully',
    schema: {
      type: 'object',
      properties: { deletedCount: { type: 'number' } },
    },
  })
  @ApiResponse({ status: 500, description: 'Internal server error' })
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
