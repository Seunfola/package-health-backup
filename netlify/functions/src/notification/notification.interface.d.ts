import type { NotificationType, NotificationPriority } from './notification.constants';
export interface Notification {
    _id?: string;
    type: NotificationType;
    repository: string;
    repositoryUrl: string;
    title: string;
    description?: string;
    priority: NotificationPriority;
    detailsUrl?: string;
    createdAt: Date;
    read: boolean;
    metadata?: Record<string, any>;
}
export interface NotificationSummary {
    total: number;
    unread: number;
    byType: Record<NotificationType, number>;
    byPriority: Record<NotificationPriority, number>;
}
export interface NotificationQueryParams {
    limit?: number;
    offset?: number;
    unreadOnly?: boolean;
    type?: NotificationType;
    priority?: NotificationPriority;
}
