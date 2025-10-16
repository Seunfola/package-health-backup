// notification.service.ts
import {
  Injectable,
  Logger,
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import {
  NotificationType,
  NotificationPriority,
  NotificationSummary,
  NotificationQueryParams,
} from './notification.interface';
import {
  CreateNotificationDto,
  UpdateNotificationDto,
  NotificationResponseDto,
} from './notification.model';
import { RepoHealthService } from 'src/repo-health/repo-health/repo-health.service';

interface NotificationDocument {
  _id: Types.ObjectId;
  type: NotificationType;
  repository: string;
  repositoryUrl: string;
  title: string;
  description?: string;
  priority: NotificationPriority;
  detailsUrl?: string;
  read: boolean;
  createdAt: Date;
  metadata?: Record<string, any>;
}

@Injectable()
export class NotificationService {
  private readonly logger = new Logger(NotificationService.name);

  constructor(
    @InjectModel('Notification')
    private readonly notificationModel: Model<NotificationDocument>,
    private readonly repoHealthService: RepoHealthService,
  ) {}

  async generateNotificationsForRepo(
    owner: string,
    repo: string,
  ): Promise<NotificationResponseDto[]> {
    const notifications: CreateNotificationDto[] = [];
    const repoUrl = `https://github.com/${owner}/${repo}`;
    const repoId = `${owner}/${repo}`;

    try {
      // Get repo health data
      const healthData = await this.repoHealthService.findRepoHealth(
        owner,
        repo,
      );

      // Generate security vulnerability notifications
      if (healthData.security_alerts > 0) {
        notifications.push({
          type: 'SECURITY_VULNERABILITY' as NotificationType,
          repository: repoId,
          repositoryUrl: repoUrl,
          title: `Security Alert: ${healthData.security_alerts} vulnerability(s) detected`,
          description: `Your repository has ${healthData.security_alerts} security vulnerability(s) that need attention.`,
          priority: (healthData.security_alerts > 5
            ? 'critical'
            : 'high') as NotificationPriority,
          detailsUrl: `${repoUrl}/security/advisories`,
          read: false,
          metadata: {
            alertCount: healthData.security_alerts,
            lastScanned: healthData.last_pushed,
          },
        });
      }

      // Generate dependency health notifications
      if (healthData.dependency_health < 70) {
        const priority: NotificationPriority =
          healthData.dependency_health < 40 ? 'high' : 'medium';
        notifications.push({
          type: 'DEPENDENCY_UPDATE' as NotificationType,
          repository: repoId,
          repositoryUrl: repoUrl,
          title: `Dependency Health: ${healthData.dependency_health}% - Needs Improvement`,
          description: `Your dependencies are ${100 - healthData.dependency_health}% below optimal health. Consider updating outdated packages.`,
          priority,
          detailsUrl: `${repoUrl}/network/dependencies`,
          read: false,
          metadata: {
            healthScore: healthData.dependency_health,
            riskyDependencies: healthData.risky_dependencies || [],
          },
        });
      }

      // Generate overall health notifications - handle both object and number formats
      let overallHealthScore: number | null = null;
      let overallHealthLabel: string | undefined = undefined;

      if (typeof healthData.overall_health === 'number') {
        overallHealthScore = healthData.overall_health;
        overallHealthLabel =
          overallHealthScore >= 80
            ? 'Excellent'
            : overallHealthScore >= 60
              ? 'Good'
              : overallHealthScore >= 40
                ? 'Moderate'
                : 'Poor';
      } else if (
        healthData.overall_health &&
        typeof healthData.overall_health === 'object'
      ) {
        const { score, label } = healthData.overall_health as {
          score?: unknown;
          label?: unknown;
        };
        overallHealthScore = typeof score === 'number' ? score : null;
        overallHealthLabel = typeof label === 'string' ? label : undefined;
      }

      if (overallHealthScore !== null && overallHealthScore < 60) {
        notifications.push({
          type: 'SYSTEM_ALERT' as NotificationType,
          repository: repoId,
          repositoryUrl: repoUrl,
          title: `Repository Health: ${overallHealthScore}% - ${overallHealthLabel || 'Needs Improvement'}`,
          description: `Your repository health score indicates areas that need improvement for better maintainability and security.`,
          priority: overallHealthScore < 40 ? 'high' : 'medium',
          detailsUrl: repoUrl,
          read: false,
          metadata: {
            healthScore: overallHealthScore,
            healthLabel: overallHealthLabel,
          },
        });
      }

      // Generate activity notifications for stale repos
      const lastPushed = new Date(healthData.last_pushed);
      const daysSinceLastPush =
        (Date.now() - lastPushed.getTime()) / (1000 * 60 * 60 * 24);

      if (daysSinceLastPush > 90) {
        notifications.push({
          type: 'SYSTEM_ALERT' as NotificationType,
          repository: repoId,
          repositoryUrl: repoUrl,
          title: 'Repository Inactivity Alert',
          description: `This repository hasn't been updated in ${Math.floor(daysSinceLastPush)} days. Consider archiving if no longer maintained.`,
          priority: 'low',
          detailsUrl: repoUrl,
          read: false,
          metadata: {
            daysSinceLastPush: Math.floor(daysSinceLastPush),
            lastPushDate: lastPushed,
          },
        });
      }

      // Save notifications to database and return with DTO
      if (notifications.length > 0) {
        const savedNotifications =
          await this.notificationModel.insertMany(notifications);
        return savedNotifications.map(
          (notification) =>
            new NotificationResponseDto(notification.toObject()),
        );
      }
    } catch (error: unknown) {
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error occurred';
      this.logger.error(
        `Failed to generate notifications for ${repoId}: ${errorMessage}`,
      );
      throw new BadRequestException(
        `Failed to generate notifications: ${errorMessage}`,
      );
    }

    return [];
  }

  async getUserNotifications(
    options?: NotificationQueryParams,
  ): Promise<NotificationResponseDto[]> {
    const {
      type,
      priority,
      unreadOnly,
      offset = 0,
      limit = 20,
    } = options ?? {};

    // Define query with precise shape
    const query: Partial<
      Record<keyof NotificationQueryParams | 'read', unknown>
    > = {};

    if (unreadOnly) query.read = false;
    if (type) query.type = type;
    if (priority) query.priority = priority;

    // Enforce safe bounds
    const safeLimit = Math.min(Math.max(limit, 1), 100);
    const safeOffset = Math.max(offset, 0);

    try {
      const notifications = await this.notificationModel
        .find(query)
        .sort({ createdAt: -1 })
        .skip(safeOffset)
        .limit(safeLimit)
        .lean()
        .exec();

      return notifications.map(
        (notification) => new NotificationResponseDto(notification),
      );
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Unknown error occurred';

      this.logger.error('Failed to fetch notifications', {
        query,
        offset: safeOffset,
        limit: safeLimit,
        error: message,
      });

      throw new BadRequestException('Failed to fetch notifications');
    }
  }

  async getNotificationSummary(): Promise<NotificationSummary> {
    try {
      const [total, unread, byType, byPriority] = await Promise.all([
        this.notificationModel.countDocuments(),
        this.notificationModel.countDocuments({ read: false }),
        this.notificationModel.aggregate<{ _id: string; count: number }>([
          { $group: { _id: '$type', count: { $sum: 1 } } },
        ]),
        this.notificationModel.aggregate<{ _id: string; count: number }>([
          { $group: { _id: '$priority', count: { $sum: 1 } } },
        ]),
      ]);

      // Type-safe type mapping
      const byTypeMap: Record<NotificationType, number> = {
        SECURITY_VULNERABILITY: 0,
        DEPENDENCY_UPDATE: 0,
        NEW_ISSUE: 0,
        PULL_REQUEST: 0,
        SYSTEM_ALERT: 0,
      };

      byType.forEach((item) => {
        if (this.isValidNotificationType(item._id)) {
          byTypeMap[item._id] = item.count;
        }
      });

      // Type-safe priority mapping
      const byPriorityMap: Record<NotificationPriority, number> = {
        low: 0,
        medium: 0,
        high: 0,
        critical: 0,
      };

      byPriority.forEach((item) => {
        if (this.isValidNotificationPriority(item._id)) {
          byPriorityMap[item._id] = item.count;
        }
      });

      return {
        total,
        unread,
        byType: byTypeMap,
        byPriority: byPriorityMap,
      };
    } catch (error: unknown) {
      this.logger.error('Failed to get notification summary:', error);
      throw new BadRequestException('Failed to get notification summary');
    }
  }

  // Type guard for NotificationType
  private isValidNotificationType(type: string): type is NotificationType {
    return [
      'SECURITY_VULNERABILITY',
      'DEPENDENCY_UPDATE',
      'NEW_ISSUE',
      'PULL_REQUEST',
      'SYSTEM_ALERT',
    ].includes(type);
  }

  // Type guard for NotificationPriority
  private isValidNotificationPriority(
    priority: string,
  ): priority is NotificationPriority {
    return ['low', 'medium', 'high', 'critical'].includes(priority);
  }

  async markAsRead(notificationId: string): Promise<NotificationResponseDto> {
    if (!Types.ObjectId.isValid(notificationId)) {
      throw new BadRequestException('Invalid notification ID');
    }

    try {
      const notification = await this.notificationModel
        .findByIdAndUpdate(notificationId, { read: true }, { new: true })
        .lean()
        .exec();

      if (!notification) {
        throw new NotFoundException(
          `Notification with ID ${notificationId} not found`,
        );
      }

      return new NotificationResponseDto(notification);
    } catch (error: unknown) {
      if (error instanceof NotFoundException) {
        throw error;
      }
      this.logger.error(
        `Failed to mark notification as read: ${notificationId}`,
        error,
      );
      throw new BadRequestException('Failed to mark notification as read');
    }
  }

  async markAllAsRead(): Promise<{ modifiedCount: number }> {
    try {
      const result = await this.notificationModel
        .updateMany({ read: false }, { read: true })
        .exec();

      return { modifiedCount: result.modifiedCount };
    } catch (error: unknown) {
      this.logger.error('Failed to mark all notifications as read:', error);
      throw new BadRequestException('Failed to mark all notifications as read');
    }
  }

  async deleteNotification(notificationId: string): Promise<void> {
    if (!Types.ObjectId.isValid(notificationId)) {
      throw new BadRequestException('Invalid notification ID');
    }

    try {
      const result = await this.notificationModel
        .findByIdAndDelete(notificationId)
        .exec();

      if (!result) {
        throw new NotFoundException(
          `Notification with ID ${notificationId} not found`,
        );
      }
    } catch (error: unknown) {
      if (error instanceof NotFoundException) {
        throw error;
      }
      this.logger.error(
        `Failed to delete notification: ${notificationId}`,
        error,
      );
      throw new BadRequestException('Failed to delete notification');
    }
  }

  async clearAllNotifications(): Promise<{ deletedCount: number }> {
    try {
      const result = await this.notificationModel.deleteMany({}).exec();
      return { deletedCount: result.deletedCount };
    } catch (error: unknown) {
      this.logger.error('Failed to clear all notifications:', error);
      throw new BadRequestException('Failed to clear all notifications');
    }
  }

  async createNotification(
    createNotificationDto: CreateNotificationDto,
  ): Promise<NotificationResponseDto> {
    try {
      const notification = new this.notificationModel({
        ...createNotificationDto,
        createdAt: new Date(),
      });

      const saved = await notification.save();
      return new NotificationResponseDto(saved.toObject());
    } catch (error: unknown) {
      this.logger.error('Failed to create notification:', error);
      throw new BadRequestException('Failed to create notification');
    }
  }

  async updateNotification(
    notificationId: string,
    updateNotificationDto: UpdateNotificationDto,
  ): Promise<NotificationResponseDto> {
    if (!Types.ObjectId.isValid(notificationId)) {
      throw new BadRequestException('Invalid notification ID');
    }

    try {
      const notification = await this.notificationModel
        .findByIdAndUpdate(notificationId, updateNotificationDto, { new: true })
        .lean()
        .exec();

      if (!notification) {
        throw new NotFoundException(
          `Notification with ID ${notificationId} not found`,
        );
      }

      return new NotificationResponseDto(notification);
    } catch (error: unknown) {
      if (error instanceof NotFoundException) {
        throw error;
      }
      this.logger.error(
        `Failed to update notification: ${notificationId}`,
        error,
      );
      throw new BadRequestException('Failed to update notification');
    }
  }
}
