import { Model } from 'mongoose';
import { RepoHealthService } from 'src/repo-health/repo-health/repo-health.service';
import { NotificationSummary as INotificationSummary, NotificationQueryParams, Notification as INotification } from './notification.interface';
import type { Cache } from 'cache-manager';
import { BulkOperationResponseDto, CreateNotificationDto, NotificationQueryDto, NotificationResponseDto, UpdateNotificationDto } from './notification.dto';
import { UserPreferencesService } from 'src/preference/preferences.service';
export declare class NotificationService {
    private readonly notificationModel;
    private readonly repoHealthService;
    private readonly userPreferencesService;
    private readonly cacheManager;
    private readonly logger;
    constructor(notificationModel: Model<INotification>, repoHealthService: RepoHealthService, userPreferencesService: UserPreferencesService, cacheManager: Cache);
    generateNotificationsForRepo(owner: string, repo: string, userId?: string): Promise<NotificationResponseDto[]>;
    getUserNotifications(options?: NotificationQueryParams | NotificationQueryDto): Promise<NotificationResponseDto[]>;
    getNotificationSummary(): Promise<INotificationSummary>;
    private isValidNotificationType;
    private isValidNotificationPriority;
    markAsRead(notificationId: string): Promise<NotificationResponseDto>;
    markAllAsRead(): Promise<{
        modifiedCount: number;
    }>;
    deleteNotification(notificationId: string): Promise<void>;
    clearAllNotifications(): Promise<{
        deletedCount: number;
    }>;
    createNotification(dto: CreateNotificationDto): Promise<NotificationResponseDto>;
    updateNotification(notificationId: string, dto: UpdateNotificationDto): Promise<NotificationResponseDto>;
    getNotificationById(notificationId: string): Promise<NotificationResponseDto>;
    markMultipleAsRead(notificationIds: string[]): Promise<BulkOperationResponseDto>;
    deleteMultipleNotifications(notificationIds: string[]): Promise<BulkOperationResponseDto>;
    getUnreadCount(): Promise<{
        count: number;
    }>;
    getNotificationsByRepository(repository: string): Promise<NotificationResponseDto[]>;
    searchNotifications(searchTerm: string, options?: NotificationQueryDto): Promise<NotificationResponseDto[]>;
    cleanupOldNotifications(daysOld?: number): Promise<{
        deletedCount: number;
    }>;
    private sendNotificationsBasedOnPreferences;
    private sendEmailNotification;
}
