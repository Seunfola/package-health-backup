export const NOTIFICATION_TYPES = [
  'SECURITY_VULNERABILITY',
  'DEPENDENCY_UPDATE',
  'NEW_ISSUE',
  'PULL_REQUEST',
  'SYSTEM_ALERT',
] as const;

export type NotificationType = (typeof NOTIFICATION_TYPES)[number];

export const NOTIFICATION_PRIORITIES = [
  'low',
  'medium',
  'high',
  'critical',
] as const;

export type NotificationPriority = (typeof NOTIFICATION_PRIORITIES)[number];

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
