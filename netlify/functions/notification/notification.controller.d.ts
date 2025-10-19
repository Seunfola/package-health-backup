import { NotificationService } from './notification.service';
import { NotificationResponseDto, MarkAllReadResponseDto, ClearAllResponseDto, BulkOperationResponseDto, CreateNotificationDto, UpdateNotificationDto, NotificationQueryDto } from './notification.dto';
import type { NotificationSummary } from './notification.interface';
export declare class NotificationController {
    private readonly notificationService;
    constructor(notificationService: NotificationService);
    getNotifications(query: NotificationQueryDto): Promise<NotificationResponseDto[]>;
    getNotificationById(id: string): Promise<NotificationResponseDto>;
    getSummary(): Promise<NotificationSummary>;
    getUnreadCount(): Promise<{
        count: number;
    }>;
    getNotificationsByRepository(repository: string): Promise<NotificationResponseDto[]>;
    searchNotifications(searchTerm: string, query: NotificationQueryDto): Promise<NotificationResponseDto[]>;
    createNotification(createNotificationDto: CreateNotificationDto): Promise<NotificationResponseDto>;
    generateNotifications(owner: string, repo: string, req: any): Promise<{
        generated: number;
        notifications: NotificationResponseDto[];
    }>;
    markAsRead(id: string): Promise<NotificationResponseDto>;
    markMultipleAsRead(body: {
        notificationIds: string[];
    }): Promise<BulkOperationResponseDto>;
    markAllAsRead(): Promise<MarkAllReadResponseDto>;
    updateNotification(id: string, updateNotificationDto: UpdateNotificationDto): Promise<NotificationResponseDto>;
    deleteNotification(id: string): Promise<{
        message: string;
    }>;
    deleteMultipleNotifications(body: {
        notificationIds: string[];
    }): Promise<BulkOperationResponseDto>;
    clearAllNotifications(): Promise<ClearAllResponseDto>;
    cleanupOldNotifications(days?: string): Promise<{
        deletedCount: number;
    }>;
}
