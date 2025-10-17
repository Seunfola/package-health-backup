// notification.constants.ts

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
