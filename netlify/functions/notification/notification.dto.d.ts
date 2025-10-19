import { NOTIFICATION_TYPES, NOTIFICATION_PRIORITIES } from './notification.constants';
export declare class CreateNotificationDto {
    type: (typeof NOTIFICATION_TYPES)[number];
    repository: string;
    repositoryUrl: string;
    title: string;
    description?: string;
    priority: (typeof NOTIFICATION_PRIORITIES)[number];
    detailsUrl?: string;
    read?: boolean;
    metadata?: Record<string, any>;
}
export declare class UpdateNotificationDto {
    read?: boolean;
    metadata?: Record<string, any>;
}
export declare class NotificationQueryDto {
    limit?: number;
    offset?: number;
    unreadOnly?: boolean;
    type?: (typeof NOTIFICATION_TYPES)[number];
    priority?: (typeof NOTIFICATION_PRIORITIES)[number];
}
export declare class NotificationResponseDto {
    _id?: string;
    type: (typeof NOTIFICATION_TYPES)[number];
    repository: string;
    repositoryUrl: string;
    title: string;
    description?: string;
    priority: (typeof NOTIFICATION_PRIORITIES)[number];
    detailsUrl?: string;
    read: boolean;
    createdAt: Date;
    updatedAt?: Date;
    metadata?: Record<string, any>;
    constructor(notification: {
        _id?: string | {
            toString: () => string;
        };
        type: (typeof NOTIFICATION_TYPES)[number];
        repository: string;
        repositoryUrl: string;
        title: string;
        description?: string;
        priority: (typeof NOTIFICATION_PRIORITIES)[number];
        detailsUrl?: string;
        read: boolean;
        createdAt: Date;
        updatedAt?: Date;
        metadata?: Record<string, any>;
    });
}
export declare class NotificationSummaryResponseDto {
    total: number;
    unread: number;
    byType: Record<string, number>;
    byPriority: Record<string, number>;
    constructor(summary: {
        total: number;
        unread: number;
        byType: Record<string, number>;
        byPriority: Record<string, number>;
    });
}
export declare class MarkAllReadResponseDto {
    modifiedCount: number;
    constructor(modifiedCount: number);
}
export declare class ClearAllResponseDto {
    deletedCount: number;
    constructor(deletedCount: number);
}
export declare class BulkOperationResponseDto {
    success: boolean;
    message: string;
    affectedIds?: string[];
    count?: number;
    constructor(response: {
        success: boolean;
        message: string;
        affectedIds?: string[];
        count?: number;
    });
}
