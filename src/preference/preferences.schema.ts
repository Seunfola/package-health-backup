import { Schema } from 'mongoose';

export const UserPreferencesSchema = new Schema(
  {
    userId: { type: String, required: true, unique: true },
    dashboardMetrics: {
      codeQualityScore: { type: Boolean, default: true },
      testCoverage: { type: Boolean, default: true },
      dependencyVulnerabilities: { type: Boolean, default: true },
      securityAlerts: { type: Boolean, default: true },
    },
    notificationPreferences: {
      emailNotifications: { type: Boolean, default: true },
      inAppNotifications: { type: Boolean, default: true },
      securityAlertThreshold: { type: Number, default: 70 },
      dependencyUpdateFrequency: {
        type: String,
        enum: ['realtime', 'daily', 'weekly'],
        default: 'daily',
      },
    },
  },
  { timestamps: true },
);
