import { Type } from 'class-transformer';
import {
  IsString,
  IsUrl,
  IsOptional,
  IsBoolean,
  IsObject,
  IsNumber,
  IsIn,
  Min,
  Max,
  Matches,
} from 'class-validator';
import {
  NOTIFICATION_TYPES,
  NOTIFICATION_PRIORITIES,
} from './notification.constants';

export class CreateNotificationDto {
  @IsIn(NOTIFICATION_TYPES)
  type!: (typeof NOTIFICATION_TYPES)[number];

  @IsString()
  @Matches(/^[a-zA-Z0-9_.-]+\/[a-zA-Z0-9_.-]+$/, {
    message: 'Repository must be in format "owner/repo"',
  })
  repository!: string;

  @IsUrl()
  repositoryUrl: string;

  @IsString()
  title: string;

  @IsString()
  @IsOptional()
  description?: string;

  @IsIn(NOTIFICATION_PRIORITIES)
  priority!: (typeof NOTIFICATION_PRIORITIES)[number];

  @IsUrl()
  @IsOptional()
  detailsUrl?: string;

  @IsBoolean()
  @IsOptional()
  read?: boolean;

  @IsObject()
  @IsOptional()
  metadata?: Record<string, any>;
}

export class UpdateNotificationDto {
  @IsBoolean()
  @IsOptional()
  read?: boolean;

  @IsObject()
  @IsOptional()
  metadata?: Record<string, any>;
}

export class NotificationQueryDto {
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  @Max(100)
  limit?: number = 10;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  offset?: number = 0;

  @IsOptional()
  @Type(() => Boolean)
  @IsBoolean()
  unreadOnly?: boolean = false;

  @IsOptional()
  @IsIn(NOTIFICATION_TYPES)
  type?: (typeof NOTIFICATION_TYPES)[number];

  @IsOptional()
  @IsIn(NOTIFICATION_PRIORITIES)
  priority?: (typeof NOTIFICATION_PRIORITIES)[number];
}

export class NotificationResponseDto {
  _id: string;
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
    _id?: string | { toString: () => string };
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
  }) {
    this._id = notification._id
      ? typeof notification._id === 'string'
        ? notification._id
        : notification._id.toString()
      : '';
    this.type = notification.type;
    this.repository = notification.repository;
    this.repositoryUrl = notification.repositoryUrl;
    this.title = notification.title;
    this.description = notification.description;
    this.priority = notification.priority;
    this.detailsUrl = notification.detailsUrl;
    this.read = notification.read;
    this.createdAt = notification.createdAt;
    this.updatedAt = notification.updatedAt;
    this.metadata = notification.metadata;
  }
}

// Additional response DTOs for different scenarios
export class NotificationSummaryResponseDto {
  total: number;
  unread: number;
  byType: Record<string, number>;
  byPriority: Record<string, number>;

  constructor(summary: {
    total: number;
    unread: number;
    byType: Record<string, number>;
    byPriority: Record<string, number>;
  }) {
    this.total = summary.total;
    this.unread = summary.unread;
    this.byType = summary.byType;
    this.byPriority = summary.byPriority;
  }
}

export class MarkAllReadResponseDto {
  modifiedCount: number;

  constructor(modifiedCount: number) {
    this.modifiedCount = modifiedCount;
  }
}

export class ClearAllResponseDto {
  deletedCount: number;

  constructor(deletedCount: number) {
    this.deletedCount = deletedCount;
  }
}

export class BulkOperationResponseDto {
  success: boolean;
  message: string;
  affectedIds?: string[];
  count?: number;

  constructor(response: {
    success: boolean;
    message: string;
    affectedIds?: string[];
    count?: number;
  }) {
    this.success = response.success;
    this.message = response.message;
    this.affectedIds = response.affectedIds;
    this.count = response.count;
  }
}
