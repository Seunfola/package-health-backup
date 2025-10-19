export declare const NOTIFICATION_TYPES: readonly ["SECURITY_VULNERABILITY", "DEPENDENCY_UPDATE", "NEW_ISSUE", "PULL_REQUEST", "SYSTEM_ALERT"];
export type NotificationType = (typeof NOTIFICATION_TYPES)[number];
export declare const NOTIFICATION_PRIORITIES: readonly ["low", "medium", "high", "critical"];
export type NotificationPriority = (typeof NOTIFICATION_PRIORITIES)[number];
