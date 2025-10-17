import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { UserPreferences } from './preferences.interface';
import { UpdatePreferencesDto } from './preferences.dto';

@Injectable()
export class UserPreferencesService {
  constructor(
    @InjectModel('UserPreferences')
    private readonly preferencesModel: Model<UserPreferences>,
  ) {}

  async getUserPreferences(userId: string): Promise<UserPreferences> {
    let preferences = await this.preferencesModel.findOne({ userId });

    if (!preferences) {
      // Create default preferences
      preferences = await this.preferencesModel.create({ userId });
    }

    return preferences;
  }

  async updateUserPreferences(
    userId: string,
    updatePreferencesDto: UpdatePreferencesDto,
  ): Promise<UserPreferences> {
    const preferences = await this.preferencesModel.findOneAndUpdate(
      { userId },
      {
        $set: {
          dashboardMetrics: updatePreferencesDto.dashboardMetrics,
          notificationPreferences: updatePreferencesDto.notificationPreferences,
        },
      },
      { new: true, upsert: true, runValidators: true },
    );

    return preferences;
  }

  async shouldSendNotification(
    userId: string,
    notificationType: string,
  ): Promise<boolean> {
    const preferences = await this.getUserPreferences(userId);

    switch (notificationType) {
      case 'email':
        return preferences.notificationPreferences.emailNotifications;
      case 'inApp':
        return preferences.notificationPreferences.inAppNotifications;
      default:
        return true;
    }
  }

  getDefaults(): any {
    return {
      dashboardMetrics: {
        codeQualityScore: true,
        testCoverage: true,
        dependencyVulnerabilities: true,
        securityAlerts: true,
      },
      notificationPreferences: {
        emailNotifications: true,
        inAppNotifications: true,
        securityAlertThreshold: 70,
        dependencyUpdateFrequency: 'daily',
      },
    };
  }

  getDefaultPreferences(): UserPreferences {
    return {
      userId: '',
      ...this.getDefaults(), // Use the getDefaults method
      createdAt: new Date(),
      updatedAt: new Date(),
    } as UserPreferences;
  }

  async resetToDefaults(userId: string): Promise<UserPreferences> {
    const defaultPreferences = new this.preferencesModel().toObject();

    return this.preferencesModel.findOneAndUpdate(
      { userId },
      {
        $set: {
          dashboardMetrics: (defaultPreferences as UserPreferences)
            .dashboardMetrics,
          notificationPreferences: (defaultPreferences as UserPreferences)
            .notificationPreferences,
        },
      },
      { new: true, upsert: true, runValidators: true },
    );
  }

  async getSecurityAlertThreshold(userId: string): Promise<number> {
    const preferences = await this.getUserPreferences(userId);
    return preferences.notificationPreferences.securityAlertThreshold;
  }
}
