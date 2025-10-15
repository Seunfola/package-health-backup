import {
  IsString,
  IsEnum,
  IsOptional,
  IsUrl,
  IsBoolean,
  IsObject,
} from 'class-validator';

export type NotificationType =
  | 'SECURITY_VULNERABILITY'
  | 'DEPENDENCY_UPDATE'
  | 'NEW_ISSUE'
  | 'PULL_REQUEST'
  | 'SYSTEM_ALERT';

export type NotificationPriority = 'low' | 'medium' | 'high' | 'critical';

export class CreateNotificationDto {
  @IsEnum([
    'SECURITY_VULNERABILITY',
    'DEPENDENCY_UPDATE',
    'NEW_ISSUE',
    'PULL_REQUEST',
    'SYSTEM_ALERT',
  ])
  type: NotificationType;

  @IsString()
  repository: string;

  @IsUrl()
  repositoryUrl: string;

  @IsString()
  title: string;

  @IsString()
  @IsOptional()
  description?: string;

  @IsEnum(['low', 'medium', 'high', 'critical'])
  priority: NotificationPriority;

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

export class NotificationResponseDto {
  _id: string;
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

  constructor(notification: {
    _id?: string | { toString: () => string };
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
    this.metadata = notification.metadata;
  }
}
