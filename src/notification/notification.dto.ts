import { Type, Transform } from 'class-transformer';
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
  IsArray,
  ValidateNested,
  IsDate,
  IsNotEmpty,
  ArrayMinSize,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  NOTIFICATION_TYPES,
  NOTIFICATION_PRIORITIES,
} from './notification.constants';

export class CreateNotificationDto {
  @ApiProperty({
    enum: NOTIFICATION_TYPES,
    example: NOTIFICATION_TYPES[0],
    description: 'Type of notification',
  })
  @IsIn(NOTIFICATION_TYPES, { message: 'Invalid notification type' })
  @IsNotEmpty()
  type!: (typeof NOTIFICATION_TYPES)[number];

  @ApiProperty({
    example: 'nestjs/nest',
    description: 'Repository in format "owner/repo"',
  })
  @IsString()
  @Matches(/^[a-zA-Z0-9_.-]+\/[a-zA-Z0-9_.-]+$/, {
    message: 'Repository must be in format "owner/repo"',
  })
  @IsNotEmpty()
  repository!: string;

  @ApiProperty({
    example: 'https://github.com/nestjs/nest',
    description: 'URL to the repository',
  })
  @IsUrl({}, { message: 'Invalid repository URL' })
  @IsNotEmpty()
  repositoryUrl!: string;

  @ApiProperty({
    example: 'Health Score Alert',
    description: 'Notification title',
  })
  @IsString()
  @IsNotEmpty()
  title!: string;

  @ApiPropertyOptional({
    example: 'Repository health score dropped below threshold',
    description: 'Detailed description of the notification',
  })
  @IsString()
  @IsOptional()
  description?: string;

  @ApiProperty({
    enum: NOTIFICATION_PRIORITIES,
    example: NOTIFICATION_PRIORITIES[0],
    description: 'Priority level of the notification',
  })
  @IsIn(NOTIFICATION_PRIORITIES, { message: 'Invalid priority level' })
  @IsNotEmpty()
  priority!: (typeof NOTIFICATION_PRIORITIES)[number];

  @ApiPropertyOptional({
    example: 'https://github.com/nestjs/nest/health',
    description: 'URL for more details',
  })
  @IsUrl({}, { message: 'Invalid details URL' })
  @IsOptional()
  detailsUrl?: string;

  @ApiPropertyOptional({
    default: false,
    description: 'Whether the notification has been read',
  })
  @Transform(({ value }) => value ?? false)
  @IsBoolean()
  @IsOptional()
  read?: boolean;

  @ApiPropertyOptional({
    example: { healthScore: 75, threshold: 80 },
    description: 'Additional metadata for the notification',
  })
  @IsObject()
  @IsOptional()
  metadata?: Record<string, any>;
}

export class UpdateNotificationDto {
  @ApiPropertyOptional({
    description: 'Mark notification as read/unread',
  })
  @IsBoolean()
  @IsOptional()
  read?: boolean;

  @ApiPropertyOptional({
    description: 'Additional metadata for the notification',
  })
  @IsObject()
  @IsOptional()
  metadata?: Record<string, any>;
}

export class NotificationQueryDto {
  @ApiPropertyOptional({
    minimum: 1,
    maximum: 100,
    default: 10,
    description: 'Number of notifications to return',
  })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  @Max(100)
  limit?: number = 10;

  @ApiPropertyOptional({
    minimum: 0,
    default: 0,
    description: 'Number of notifications to skip',
  })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  offset?: number = 0;

  @ApiPropertyOptional({
    default: false,
    description: 'Return only unread notifications',
  })
  @IsOptional()
  @Type(() => Boolean)
  @IsBoolean()
  unreadOnly?: boolean = false;

  @ApiPropertyOptional({
    enum: NOTIFICATION_TYPES,
    description: 'Filter by notification type',
  })
  @IsOptional()
  @IsIn(NOTIFICATION_TYPES)
  type?: (typeof NOTIFICATION_TYPES)[number];

  @ApiPropertyOptional({
    enum: NOTIFICATION_PRIORITIES,
    description: 'Filter by priority level',
  })
  @IsOptional()
  @IsIn(NOTIFICATION_PRIORITIES)
  priority?: (typeof NOTIFICATION_PRIORITIES)[number];

  @ApiPropertyOptional({
    example: 'nestjs/nest',
    description: 'Filter by repository',
  })
  @IsOptional()
  @IsString()
  @Matches(/^[a-zA-Z0-9_.-]+\/[a-zA-Z0-9_.-]+$/)
  repository?: string;
}

export class NotificationResponseDto {
  @ApiProperty({ description: 'Notification ID' })
  _id?: string;

  @ApiProperty({ enum: NOTIFICATION_TYPES })
  type: (typeof NOTIFICATION_TYPES)[number];

  @ApiProperty({ example: 'nestjs/nest' })
  repository: string;

  @ApiProperty({ example: 'https://github.com/nestjs/nest' })
  repositoryUrl: string;

  @ApiProperty({ example: 'Health Score Alert' })
  title: string;

  @ApiPropertyOptional({
    example: 'Repository health score dropped below threshold',
  })
  description?: string;

  @ApiProperty({ enum: NOTIFICATION_PRIORITIES })
  priority: (typeof NOTIFICATION_PRIORITIES)[number];

  @ApiPropertyOptional({ example: 'https://github.com/nestjs/nest/health' })
  detailsUrl?: string;

  @ApiProperty({ default: false })
  read: boolean;

  @ApiProperty({ type: Date })
  createdAt: Date;

  @ApiPropertyOptional({ type: Date })
  updatedAt?: Date;

  @ApiPropertyOptional({ type: Object })
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

export class NotificationSummaryResponseDto {
  @ApiProperty({ description: 'Total number of notifications' })
  total: number;

  @ApiProperty({ description: 'Number of unread notifications' })
  unread: number;

  @ApiProperty({ type: Object, description: 'Count by notification type' })
  byType: Record<string, number>;

  @ApiProperty({ type: Object, description: 'Count by priority level' })
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
  @ApiProperty({ description: 'Number of notifications marked as read' })
  modifiedCount: number;

  constructor(modifiedCount: number) {
    this.modifiedCount = modifiedCount;
  }
}

export class ClearAllResponseDto {
  @ApiProperty({ description: 'Number of notifications deleted' })
  deletedCount: number;

  constructor(deletedCount: number) {
    this.deletedCount = deletedCount;
  }
}

export class BulkOperationResponseDto {
  @ApiProperty({ description: 'Whether the operation was successful' })
  success: boolean;

  @ApiProperty({ description: 'Operation result message' })
  message: string;

  @ApiPropertyOptional({
    type: [String],
    description: 'Affected notification IDs',
  })
  affectedIds?: string[];

  @ApiPropertyOptional({ description: 'Number of affected notifications' })
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

export class BulkUpdateNotificationsDto {
  @ApiProperty({ type: [String], description: 'Notification IDs to update' })
  @ArrayMinSize(1, { message: 'At least one notification ID is required' })
  @IsArray()
  @IsString({ each: true })
  @IsNotEmpty({ each: true })
  ids!: string[];

  @ApiProperty({ type: UpdateNotificationDto })
  @ValidateNested()
  @Type(() => UpdateNotificationDto)
  updates!: UpdateNotificationDto;
}
export class BulkDeleteNotificationsDto {
  @ApiProperty({ type: [String], description: 'Notification IDs to delete' })
  @IsArray()
  @ArrayMinSize(1, { message: 'At least one notification ID is required' })
  @IsString({ each: true })
  @IsNotEmpty({ each: true })
  ids!: string[];
}


export class NotificationPreferencesDto {
  @ApiPropertyOptional({
    default: true,
    description: 'Enable email notifications',
  })
  @Transform(({ value }) => value ?? true)
  @IsBoolean()
  @IsOptional()
  emailEnabled?: boolean;

  @ApiPropertyOptional({
    default: true,
    description: 'Enable push notifications',
  })
  @Transform(({ value }) => value ?? true)
  @IsBoolean()
  @IsOptional()
  pushEnabled?: boolean;

  @ApiPropertyOptional({
    type: Object,
    description: 'Notification type preferences',
    example: { health_alert: true, security_alert: false },
  })
  @IsObject()
  @IsOptional()
  typePreferences?: Record<string, boolean>;

  @ApiPropertyOptional({
    type: Object,
    description: 'Priority level preferences',
    example: { high: true, medium: true, low: false },
  })
  @IsObject()
  @IsOptional()
  priorityPreferences?: Record<string, boolean>;
}
