export declare class DashboardMetricsDto {
    codeQualityScore: boolean;
    testCoverage: boolean;
    dependencyVulnerabilities: boolean;
    securityAlerts: boolean;
}
export declare class NotificationPreferencesDto {
    emailNotifications: boolean;
    inAppNotifications: boolean;
    securityAlertThreshold: number;
    dependencyUpdateFrequency: string;
}
export declare class UpdatePreferencesDto {
    dashboardMetrics: DashboardMetricsDto;
    notificationPreferences: NotificationPreferencesDto;
}
export declare class PreferencesResponseDto {
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
    });
}
