export interface DashboardMetrics {
  codeQualityScore: boolean;
  testCoverage: boolean;
  dependencyVulnerabilities: boolean;
  securityAlerts: boolean;
}

export interface NotificationPreferences {
  emailNotifications: boolean;
  inAppNotifications: boolean;
  securityAlertThreshold: number;
  dependencyUpdateFrequency: 'realtime' | 'daily' | 'weekly';
}

export interface UserPreferences {
  _id?: string;
  userId: string;
  dashboardMetrics: DashboardMetrics;
  notificationPreferences: NotificationPreferences;
  createdAt: Date;
  updatedAt: Date;
}
