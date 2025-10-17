import {
  Injectable,
  Logger,
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types, FilterQuery } from 'mongoose';
import { RepoHealthService } from 'src/repo-health/repo-health/repo-health.service';
import {
  NotificationSummary as INotificationSummary,
  NotificationQueryParams,
  Notification as INotification,
} from './notification.interface';

import {
  NOTIFICATION_TYPES,
  NOTIFICATION_PRIORITIES,
  NotificationPriority,
  NotificationType,
} from './notification.constants';
import {
  BulkOperationResponseDto,
  CreateNotificationDto,
  NotificationQueryDto,
  NotificationResponseDto,
  UpdateNotificationDto,
} from './notification.dto';

@Injectable()
export class NotificationService {
  private readonly logger = new Logger(NotificationService.name);

  constructor(
    @InjectModel('Notification')
    private readonly notificationModel: Model<INotification>,
    private readonly repoHealthService: RepoHealthService,
  ) {}

  // GENERATE NOTIFICATIONS FOR A REPO
  async generateNotificationsForRepo(
    owner: string,
    repo: string,
  ): Promise<NotificationResponseDto[]> {
    const notifications: CreateNotificationDto[] = [];
    const repoUrl = `https://github.com/${owner}/${repo}`;
    const repoId = `${owner}/${repo}`;

    try {
      const healthData = await this.repoHealthService.findRepoHealth(
        owner,
        repo,
      );

      if (healthData.security_alerts > 0) {
        notifications.push({
          type: 'SECURITY_VULNERABILITY',
          repository: repoId,
          repositoryUrl: repoUrl,
          title: `Security Alert: ${healthData.security_alerts} vulnerability(s) detected`,
          description: `Your repository has ${healthData.security_alerts} security vulnerability(s) that need attention.`,
          priority: healthData.security_alerts > 5 ? 'critical' : 'high',
          detailsUrl: `${repoUrl}/security/advisories`,
          read: false,
          metadata: {
            alertCount: healthData.security_alerts,
            lastScanned: healthData.last_pushed,
          },
        });
      }

      if (healthData.dependency_health < 70) {
        const priority: NotificationPriority =
          healthData.dependency_health < 40 ? 'high' : 'medium';
        notifications.push({
          type: 'DEPENDENCY_UPDATE',
          repository: repoId,
          repositoryUrl: repoUrl,
          title: `Dependency Health: ${healthData.dependency_health}% - Needs Improvement`,
          description: `Your dependencies are ${
            100 - healthData.dependency_health
          }% below optimal health. Consider updating outdated packages.`,
          priority,
          detailsUrl: `${repoUrl}/network/dependencies`,
          read: false,
          metadata: {
            healthScore: healthData.dependency_health,
            riskyDependencies: healthData.risky_dependencies || [],
          },
        });
      }

      // Overall health
      let overallScore: number | null = null;
      let overallLabel: string | undefined;

      if (typeof healthData.overall_health === 'number') {
        overallScore = healthData.overall_health;
        overallLabel =
          overallScore >= 80
            ? 'Excellent'
            : overallScore >= 60
              ? 'Good'
              : overallScore >= 40
                ? 'Moderate'
                : 'Poor';
      } else if (
        healthData.overall_health &&
        typeof healthData.overall_health === 'object' &&
        healthData.overall_health !== null
      ) {
        const healthObj = healthData.overall_health as {
          score?: unknown;
          label?: unknown;
        };
        overallScore =
          typeof healthObj.score === 'number' ? healthObj.score : null;
        overallLabel =
          typeof healthObj.label === 'string' ? healthObj.label : undefined;
      }

      if (overallScore !== null && overallScore < 60) {
        notifications.push({
          type: 'SYSTEM_ALERT',
          repository: repoId,
          repositoryUrl: repoUrl,
          title: `Repository Health: ${overallScore}% - ${overallLabel ?? 'Needs Improvement'}`,
          description: `Your repository health score indicates areas that need improvement for better maintainability and security.`,
          priority: overallScore < 40 ? 'high' : 'medium',
          detailsUrl: repoUrl,
          read: false,
          metadata: { healthScore: overallScore, healthLabel: overallLabel },
        });
      }

      // Inactivity alert
      const lastPushed = new Date(healthData.last_pushed);
      const daysSinceLastPush =
        (Date.now() - lastPushed.getTime()) / (1000 * 60 * 60 * 24);
      if (daysSinceLastPush > 90) {
        notifications.push({
          type: 'SYSTEM_ALERT',
          repository: repoId,
          repositoryUrl: repoUrl,
          title: 'Repository Inactivity Alert',
          description: `This repository hasn't been updated in ${Math.floor(
            daysSinceLastPush,
          )} days. Consider archiving if no longer maintained.`,
          priority: 'low',
          detailsUrl: repoUrl,
          read: false,
          metadata: {
            daysSinceLastPush: Math.floor(daysSinceLastPush),
            lastPushDate: lastPushed,
          },
        });
      }

      if (notifications.length > 0) {
        const saved = await this.notificationModel.insertMany(notifications);
        return saved.map((n) => new NotificationResponseDto(n.toObject()));
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      this.logger.error(
        `Failed to generate notifications for ${repoId}: ${message}`,
      );
      throw new BadRequestException(
        `Failed to generate notifications: ${message}`,
      );
    }

    return [];
  }

  // GET USER NOTIFICATIONS
  async getUserNotifications(
    options?: NotificationQueryParams | NotificationQueryDto,
  ): Promise<NotificationResponseDto[]> {
    const {
      type,
      priority,
      unreadOnly,
      offset = 0,
      limit = 20,
    } = options ?? {};

    const query: FilterQuery<INotification> = {};

    if (unreadOnly) query.read = false;
    if (type) query.type = type;
    if (priority) query.priority = priority;

    try {
      const notifications = await this.notificationModel
        .find(query)
        .sort({ createdAt: -1 })
        .skip(Math.max(offset, 0))
        .limit(Math.min(Math.max(limit, 1), 100))
        .lean()
        .exec();

      return notifications.map((n) => new NotificationResponseDto(n));
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      this.logger.error(`Failed to fetch notifications: ${message}`, { query });
      throw new BadRequestException(
        `Failed to fetch notifications: ${message}`,
      );
    }
  }

  // GET SUMMARY
  async getNotificationSummary(): Promise<INotificationSummary> {
    try {
      const [total, unread, byTypeRaw, byPriorityRaw] = await Promise.all([
        this.notificationModel.countDocuments(),
        this.notificationModel.countDocuments({ read: false }),
        this.notificationModel.aggregate<{ _id: string; count: number }>([
          { $group: { _id: '$type', count: { $sum: 1 } } },
        ]),
        this.notificationModel.aggregate<{ _id: string; count: number }>([
          { $group: { _id: '$priority', count: { $sum: 1 } } },
        ]),
      ]);

      // Initialize with all types set to 0
      const byType: Record<NotificationType, number> = {
        SECURITY_VULNERABILITY: 0,
        DEPENDENCY_UPDATE: 0,
        NEW_ISSUE: 0,
        PULL_REQUEST: 0,
        SYSTEM_ALERT: 0,
      };

      byTypeRaw.forEach((item) => {
        if (this.isValidNotificationType(item._id)) {
          byType[item._id] = item.count;
        }
      });

      // Initialize with all priorities set to 0
      const byPriority: Record<NotificationPriority, number> = {
        low: 0,
        medium: 0,
        high: 0,
        critical: 0,
      };

      byPriorityRaw.forEach((item) => {
        if (this.isValidNotificationPriority(item._id)) {
          byPriority[item._id] = item.count;
        }
      });

      return { total, unread, byType, byPriority };
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      this.logger.error('Failed to get notification summary', { message });
      throw new BadRequestException('Failed to get notification summary');
    }
  }

  // TYPE GUARDS
  private isValidNotificationType(type: string): type is NotificationType {
    return NOTIFICATION_TYPES.includes(type as NotificationType);
  }

  private isValidNotificationPriority(
    priority: string,
  ): priority is NotificationPriority {
    return NOTIFICATION_PRIORITIES.includes(priority as NotificationPriority);
  }

  // MARK AS READ
  async markAsRead(notificationId: string): Promise<NotificationResponseDto> {
    if (!Types.ObjectId.isValid(notificationId)) {
      throw new BadRequestException('Invalid notification ID');
    }

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
  }

  // MARK ALL AS READ
  async markAllAsRead(): Promise<{ modifiedCount: number }> {
    const result = await this.notificationModel
      .updateMany({ read: false }, { read: true })
      .exec();
    return { modifiedCount: result.modifiedCount };
  }

  // DELETE
  async deleteNotification(notificationId: string): Promise<void> {
    if (!Types.ObjectId.isValid(notificationId)) {
      throw new BadRequestException('Invalid notification ID');
    }

    const result = await this.notificationModel
      .findByIdAndDelete(notificationId)
      .exec();
    if (!result) {
      throw new NotFoundException(
        `Notification with ID ${notificationId} not found`,
      );
    }
  }

  async clearAllNotifications(): Promise<{ deletedCount: number }> {
    const result = await this.notificationModel.deleteMany({}).exec();
    return { deletedCount: result.deletedCount };
  }

  async createNotification(
    dto: CreateNotificationDto,
  ): Promise<NotificationResponseDto> {
    const notification = new this.notificationModel({
      ...dto,
      createdAt: new Date(),
    });
    const saved = await notification.save();
    return new NotificationResponseDto(saved.toObject());
  }

  async updateNotification(
    notificationId: string,
    dto: UpdateNotificationDto,
  ): Promise<NotificationResponseDto> {
    if (!Types.ObjectId.isValid(notificationId)) {
      throw new BadRequestException('Invalid notification ID');
    }

    const notification = await this.notificationModel
      .findByIdAndUpdate(notificationId, dto, { new: true })
      .lean()
      .exec();

    if (!notification) {
      throw new NotFoundException(
        `Notification with ID ${notificationId} not found`,
      );
    }
    return new NotificationResponseDto(notification);
  }

  // GET NOTIFICATION BY ID
  async getNotificationById(
    notificationId: string,
  ): Promise<NotificationResponseDto> {
    if (!Types.ObjectId.isValid(notificationId)) {
      throw new BadRequestException('Invalid notification ID');
    }

    const notification = await this.notificationModel
      .findById(notificationId)
      .lean()
      .exec();

    if (!notification) {
      throw new NotFoundException(
        `Notification with ID ${notificationId} not found`,
      );
    }
    return new NotificationResponseDto(notification);
  }

  async markMultipleAsRead(
    notificationIds: string[],
  ): Promise<BulkOperationResponseDto> {
    // Validate all IDs
    const invalidIds = notificationIds.filter(
      (id) => !Types.ObjectId.isValid(id),
    );
    if (invalidIds.length > 0) {
      throw new BadRequestException(
        `Invalid notification IDs: ${invalidIds.join(', ')}`,
      );
    }

    const result = await this.notificationModel
      .updateMany({ _id: { $in: notificationIds } }, { read: true })
      .exec();

    return new BulkOperationResponseDto({
      success: true,
      message: `Successfully marked ${result.modifiedCount} notifications as read`,
      affectedIds: notificationIds,
      count: result.modifiedCount,
    });
  }

  async deleteMultipleNotifications(
    notificationIds: string[],
  ): Promise<BulkOperationResponseDto> {
    // Validate all IDs
    const invalidIds = notificationIds.filter(
      (id) => !Types.ObjectId.isValid(id),
    );
    if (invalidIds.length > 0) {
      throw new BadRequestException(
        `Invalid notification IDs: ${invalidIds.join(', ')}`,
      );
    }

    const result = await this.notificationModel
      .deleteMany({ _id: { $in: notificationIds } })
      .exec();

    return new BulkOperationResponseDto({
      success: true,
      message: `Successfully deleted ${result.deletedCount} notifications`,
      affectedIds: notificationIds,
      count: result.deletedCount,
    });
  }

  // NOTIFICATION STATISTICS
  async getUnreadCount(): Promise<{ count: number }> {
    const count = await this.notificationModel.countDocuments({ read: false });
    return { count };
  }

  async getNotificationsByRepository(
    repository: string,
  ): Promise<NotificationResponseDto[]> {
    const notifications = await this.notificationModel
      .find({ repository })
      .sort({ createdAt: -1 })
      .lean()
      .exec();

    return notifications.map((n) => new NotificationResponseDto(n));
  }

  // ADVANCED FILTERING
  async searchNotifications(
    searchTerm: string,
    options?: NotificationQueryDto,
  ): Promise<NotificationResponseDto[]> {
    const { limit = 20, offset = 0, ...filters } = options ?? {};

    const query: FilterQuery<INotification> = {
      ...filters,
      $or: [
        { title: { $regex: searchTerm, $options: 'i' } },
        { description: { $regex: searchTerm, $options: 'i' } },
        { repository: { $regex: searchTerm, $options: 'i' } },
      ],
    };

    const notifications = await this.notificationModel
      .find(query)
      .sort({ createdAt: -1 })
      .skip(Math.max(offset, 0))
      .limit(Math.min(Math.max(limit, 1), 100))
      .lean()
      .exec();

    return notifications.map((n) => new NotificationResponseDto(n));
  }

  // NOTIFICATION CLEANUP
  async cleanupOldNotifications(
    daysOld: number = 30,
  ): Promise<{ deletedCount: number }> {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - daysOld);

    const result = await this.notificationModel
      .deleteMany({
        createdAt: { $lt: cutoffDate },
        read: true,
      })
      .exec();

    this.logger.log(
      `Cleaned up ${result.deletedCount} notifications older than ${daysOld} days`,
    );
    return { deletedCount: result.deletedCount };
  }
}
