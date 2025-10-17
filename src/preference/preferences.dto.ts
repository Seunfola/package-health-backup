import { IsBoolean, IsNumber, IsIn, Min, Max } from 'class-validator';

export class DashboardMetricsDto {
  @IsBoolean()
  codeQualityScore: boolean;

  @IsBoolean()
  testCoverage: boolean;

  @IsBoolean()
  dependencyVulnerabilities: boolean;

  @IsBoolean()
  securityAlerts: boolean;
}

export class NotificationPreferencesDto {
  @IsBoolean()
  emailNotifications: boolean;

  @IsBoolean()
  inAppNotifications: boolean;

  @IsNumber()
  @Min(0)
  @Max(100)
  securityAlertThreshold: number;

  @IsIn(['realtime', 'daily', 'weekly'])
  dependencyUpdateFrequency: string;
}

export class UpdatePreferencesDto {
  dashboardMetrics: DashboardMetricsDto;
  notificationPreferences: NotificationPreferencesDto;
}

export class PreferencesResponseDto {
  userId: string;
  dashboardMetrics: DashboardMetricsDto;
  notificationPreferences: NotificationPreferencesDto;
  createdAt: Date;
  updatedAt: Date;

  constructor(preferences: {
    userId: string;
    dashboardMetrics: DashboardMetricsDto;
    notificationPreferences: NotificationPreferencesDto;
    createdAt: Date;
    updatedAt: Date;
  }) {
    this.userId = preferences.userId;
    this.dashboardMetrics = preferences.dashboardMetrics;
    this.notificationPreferences = preferences.notificationPreferences;
    this.createdAt = preferences.createdAt;
    this.updatedAt = preferences.updatedAt;
  }
}
