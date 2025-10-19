import { Schema } from 'mongoose';
export declare const UserPreferencesSchema: Schema<any, import("mongoose").Model<any, any, any, any, any, any>, {}, {}, {}, {}, {
    timestamps: true;
}, {
    userId: string;
    dashboardMetrics?: {
        codeQualityScore: boolean;
        testCoverage: boolean;
        dependencyVulnerabilities: boolean;
        securityAlerts: boolean;
    } | null | undefined;
    notificationPreferences?: {
        emailNotifications: boolean;
        inAppNotifications: boolean;
        securityAlertThreshold: number;
        dependencyUpdateFrequency: "realtime" | "daily" | "weekly";
    } | null | undefined;
} & import("mongoose").DefaultTimestampProps, import("mongoose").Document<unknown, {}, import("mongoose").FlatRecord<{
    userId: string;
    dashboardMetrics?: {
        codeQualityScore: boolean;
        testCoverage: boolean;
        dependencyVulnerabilities: boolean;
        securityAlerts: boolean;
    } | null | undefined;
    notificationPreferences?: {
        emailNotifications: boolean;
        inAppNotifications: boolean;
        securityAlertThreshold: number;
        dependencyUpdateFrequency: "realtime" | "daily" | "weekly";
    } | null | undefined;
} & import("mongoose").DefaultTimestampProps>, {}, import("mongoose").ResolveSchemaOptions<{
    timestamps: true;
}>> & import("mongoose").FlatRecord<{
    userId: string;
    dashboardMetrics?: {
        codeQualityScore: boolean;
        testCoverage: boolean;
        dependencyVulnerabilities: boolean;
        securityAlerts: boolean;
    } | null | undefined;
    notificationPreferences?: {
        emailNotifications: boolean;
        inAppNotifications: boolean;
        securityAlertThreshold: number;
        dependencyUpdateFrequency: "realtime" | "daily" | "weekly";
    } | null | undefined;
} & import("mongoose").DefaultTimestampProps> & {
    _id: import("mongoose").Types.ObjectId;
} & {
    __v: number;
}>;
