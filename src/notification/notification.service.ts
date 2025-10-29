import {
  Injectable,
  Logger,
  BadRequestException,
  NotFoundException,
  Inject,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types, FilterQuery } from 'mongoose';
import type { Cache } from 'cache-manager';
import {
  Notification as INotification,
  NotificationSummary as INotificationSummary,
  NotificationQueryParams,
} from './notification.interface';
import {
  BulkOperationResponseDto,
  CreateNotificationDto,
  NotificationQueryDto,
  NotificationResponseDto,
  UpdateNotificationDto,
} from './notification.dto';
import {
  NOTIFICATION_TYPES,
  NOTIFICATION_PRIORITIES,
  NotificationPriority,
  NotificationType,
} from './notification.constants';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { RepoHealthService } from 'src/repo-health/services/repo-health.service';
import { UserPreferencesService } from 'src/preference/preferences.service';
import { UserPreferences } from 'src/preference/preferences.interface';

@Injectable()
export class NotificationService {
  private readonly logger = new Logger(NotificationService.name);

  private static readonly CACHE_TTL = 120;
  private static readonly DEFAULT_CLEANUP_DAYS = 30;

  constructor(
    @InjectModel('Notification')
    private readonly notificationModel: Model<INotification>,
    private readonly repoHealthService: RepoHealthService,
    private readonly userPreferencesService: UserPreferencesService,
    @Inject(CACHE_MANAGER) private readonly cacheManager: Cache,
  ) {}

  private validateObjectId(id: string, label = 'ID') {
    if (!Types.ObjectId.isValid(id)) {
      throw new BadRequestException(`Invalid ${label}`);
    }
  }

  private isValidNotificationType(type: string): type is NotificationType {
    return NOTIFICATION_TYPES.includes(type as NotificationType);
  }

  private isValidNotificationPriority(
    priority: string,
  ): priority is NotificationPriority {
    return NOTIFICATION_PRIORITIES.includes(priority as NotificationPriority);
  }

  async generateNotificationsForRepo(
    owner: string,
    repo: string,
    userId?: string,
  ): Promise<NotificationResponseDto[]> {
    const notifications: CreateNotificationDto[] = [];
    const repoUrl = `https://github.com/${owner.trim()}/${repo.trim()}`;
    const repoId = `${owner.trim()}/${repo.trim()}`;

    try {
      const healthData = await this.repoHealthService.findRepoHealth(
        owner,
        repo,
      );

      let userPreferences: UserPreferences | null = null;
      if (userId) {
        userPreferences =
          await this.userPreferencesService.getUserPreferences(userId);
      }

      // Security Alert
      if (healthData.security_alerts > 0) {
        const showSecurity =
          !userPreferences || userPreferences.dashboardMetrics.securityAlerts;
        if (showSecurity) {
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
              ...(userId && { userId }),
            },
          });
        }
      }

      // Dependency Health
      if (healthData.dependency_health < 70) {
        const showDependency =
          !userPreferences ||
          userPreferences.dashboardMetrics.dependencyVulnerabilities;
        if (showDependency) {
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
              userId,
            },
          });
        }
      }

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
        typeof healthData.overall_health === 'object' &&
        healthData.overall_health !== null
      ) {
        const obj = healthData.overall_health as {
          score?: number;
          label?: string;
        };
        overallScore = obj.score ?? null;
        overallLabel = obj.label;
      }

      if (overallScore !== null && overallScore < 60) {
        const showHealth =
          !userPreferences || userPreferences.dashboardMetrics.codeQualityScore;
        if (showHealth) {
          notifications.push({
            type: 'SYSTEM_ALERT',
            repository: repoId,
            repositoryUrl: repoUrl,
            title: `Repository Health: ${overallScore}% - ${overallLabel ?? 'Needs Improvement'}`,
            description:
              'Your repository health score indicates areas that need improvement.',
            priority: overallScore < 40 ? 'high' : 'medium',
            detailsUrl: repoUrl,
            read: false,
            metadata: {
              healthScore: overallScore,
              healthLabel: overallLabel,
              userId,
            },
          });
        }
      }

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
          )} days.`,
          priority: 'low',
          detailsUrl: repoUrl,
          read: false,
          metadata: {
            daysSinceLastPush: Math.floor(daysSinceLastPush),
            lastPushDate: lastPushed,
            userId,
          },
        });
      }

      if (notifications.length > 0) {
        const saved = await this.notificationModel.insertMany(notifications);

        if (userId) {
          await this.sendNotificationsBasedOnPreferences(userId, saved);
        }

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

  async createNotification(
    createDto: CreateNotificationDto,
  ): Promise<NotificationResponseDto> {
    const created = await this.notificationModel.create({
      ...createDto,
      createdAt: new Date(),
      read: false,
    });
    await this.cacheManager.del('notification:summary');
    return new NotificationResponseDto(created);
  }

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

  async getNotificationSummary(): Promise<INotificationSummary> {
    const cacheKey = 'notification:summary';
    const cached = await this.cacheManager.get<INotificationSummary>(cacheKey);
    if (cached) return cached;

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

      const byType = Object.fromEntries(
        NOTIFICATION_TYPES.map((t) => [t, 0]),
      ) as Record<NotificationType, number>;
      const byPriority = Object.fromEntries(
        NOTIFICATION_PRIORITIES.map((p) => [p, 0]),
      ) as Record<NotificationPriority, number>;

      byTypeRaw.forEach((t) => {
        if (this.isValidNotificationType(t._id)) byType[t._id] = t.count;
      });
      byPriorityRaw.forEach((p) => {
        if (this.isValidNotificationPriority(p._id))
          byPriority[p._id] = p.count;
      });

      const summary = { total, unread, byType, byPriority };
      await this.cacheManager.set(
        cacheKey,
        summary,
        NotificationService.CACHE_TTL,
      );
      return summary;
    } catch (err) {
      this.logger.error('Failed to get notification summary', err);
      throw new BadRequestException('Failed to get notification summary');
    }
  }

  async getUnreadCount(): Promise<{ count: number }> {
    const count = await this.notificationModel.countDocuments({ read: false });
    return { count };
  }

  async markAsRead(id: string): Promise<NotificationResponseDto> {
    this.validateObjectId(id, 'notification ID');
    const updated = await this.notificationModel
      .findByIdAndUpdate(id, { read: true }, { new: true })
      .lean()
      .exec();

    if (!updated)
      throw new NotFoundException(`Notification with ID ${id} not found`);
    await this.cacheManager.del('notification:summary');
    return new NotificationResponseDto(updated);
  }

  async markAllAsRead(): Promise<{ modifiedCount: number }> {
    const result = await this.notificationModel
      .updateMany({ read: false }, { read: true })
      .exec();
    await this.cacheManager.del('notification:summary');
    return { modifiedCount: result.modifiedCount };
  }

  async deleteNotification(id: string): Promise<void> {
    this.validateObjectId(id, 'notification ID');
    const deleted = await this.notificationModel.findByIdAndDelete(id).exec();
    if (!deleted)
      throw new NotFoundException(`Notification with ID ${id} not found`);
    await this.cacheManager.del('notification:summary');
  }

  async clearAllNotifications(): Promise<{ deletedCount: number }> {
    const result = await this.notificationModel.deleteMany({}).exec();
    await this.cacheManager.del('notification:summary');
    return { deletedCount: result.deletedCount };
  }

  async markMultipleAsRead(ids: string[]): Promise<BulkOperationResponseDto> {
    if (!ids.length) {
      return new BulkOperationResponseDto({
        success: true,
        message: 'No notifications to mark as read',
        affectedIds: [],
        updated: 0,
      });
    }

    // Validate IDs
    ids.forEach((id) => this.validateObjectId(id));

    // Perform bulk update
    const result = await this.notificationModel
      .updateMany({ _id: { $in: ids } }, { read: true })
      .exec();

    await this.cacheManager.del('notification:summary');

    return new BulkOperationResponseDto({
      success: true,
      message: `Marked ${result.modifiedCount} notifications as read`,
      affectedIds: ids,
      updated: result.modifiedCount,
    });
  }

  async deleteMultipleNotifications(
    ids: string[],
  ): Promise<BulkOperationResponseDto> {
    ids.forEach((id) => this.validateObjectId(id));
    const result = await this.notificationModel
      .deleteMany({ _id: { $in: ids } })
      .exec();
    await this.cacheManager.del('notification:summary');
    return new BulkOperationResponseDto({
      success: true,
      message: `Deleted ${result.deletedCount} notifications`,
      affectedIds: ids,
      deleted: result.deletedCount,
    });
  }

  async updateNotification(
    id: string,
    dto: UpdateNotificationDto,
  ): Promise<NotificationResponseDto> {
    this.validateObjectId(id, 'notification ID');
    const updated = await this.notificationModel
      .findByIdAndUpdate(id, dto, { new: true })
      .lean()
      .exec();
    if (!updated)
      throw new NotFoundException(`Notification with ID ${id} not found`);
    await this.cacheManager.del('notification:summary');
    return new NotificationResponseDto(updated);
  }

  async getNotificationById(id: string): Promise<NotificationResponseDto> {
    this.validateObjectId(id, 'notification ID');
    const found = await this.notificationModel.findById(id).lean().exec();
    if (!found)
      throw new NotFoundException(`Notification with ID ${id} not found`);
    return new NotificationResponseDto(found);
  }

  async getNotificationsByRepository(
    repo: string,
  ): Promise<NotificationResponseDto[]> {
    const results = await this.notificationModel
      .find({ repository: repo })
      .sort({ createdAt: -1 })
      .lean()
      .exec();
    return results.map((r) => new NotificationResponseDto(r));
  }

  async searchNotifications(
    term: string,
    options?: NotificationQueryDto,
  ): Promise<NotificationResponseDto[]> {
    const { limit = 20, offset = 0, ...filters } = options ?? {};
    const query: FilterQuery<INotification> = {
      ...filters,
      $or: [
        { title: { $regex: term, $options: 'i' } },
        { description: { $regex: term, $options: 'i' } },
        { repository: { $regex: term, $options: 'i' } },
      ],
    };

    const results = await this.notificationModel
      .find(query)
      .sort({ createdAt: -1 })
      .skip(Math.max(offset, 0))
      .limit(Math.min(Math.max(limit, 1), 100))
      .lean()
      .exec();

    return results.map((r) => new NotificationResponseDto(r));
  }

  async cleanupOldNotifications(
    daysOld = NotificationService.DEFAULT_CLEANUP_DAYS,
  ): Promise<{ deletedCount: number }> {
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - daysOld);

    const result = await this.notificationModel
      .deleteMany({ createdAt: { $lt: cutoff }, read: true })
      .exec();

    this.logger.log(
      `Cleaned up ${result.deletedCount} notifications older than ${daysOld} days`,
    );
    await this.cacheManager.del('notification:summary');
    return { deletedCount: result.deletedCount };
  }

  private async sendNotificationsBasedOnPreferences(
    userId: string,
    notifications: any[],
  ) {
    try {
      const preferences =
        await this.userPreferencesService.getUserPreferences(userId);

      for (const n of notifications) {
        if (preferences.notificationPreferences.inAppNotifications) {
          this.logger.log(`In-app notification stored for user ${userId}`);
        }

        if (preferences.notificationPreferences.emailNotifications) {
          await this.sendEmailNotification(userId, n);
        }

        if (n.type === 'SECURITY_VULNERABILITY') {
          const threshold =
            preferences.notificationPreferences.securityAlertThreshold;
          const alertCount = n.metadata?.alertCount ?? 0;
          if (alertCount > threshold) {
            this.logger.warn(
              `High priority security alert for user ${userId}: ${alertCount} vulnerabilities`,
            );
          }
        }
      }
    } catch (error) {
      this.logger.error(
        'Error sending notifications based on preferences',
        error,
      );
    }
  }

  private async sendEmailNotification(userId: string, n: { title: string }) {
    await Promise.resolve();
    this.logger.log(`Would send email to user ${userId} for: ${n.title}`);
  }
}
