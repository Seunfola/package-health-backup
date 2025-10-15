export type NotificationType =
  | 'SECURITY_VULNERABILITY'
  | 'DEPENDENCY_UPDATE'
  | 'NEW_ISSUE'
  | 'PULL_REQUEST'
  | 'SYSTEM_ALERT';

export type NotificationPriority = 'low' | 'medium' | 'high' | 'critical';

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
