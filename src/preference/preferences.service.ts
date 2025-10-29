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
    this.validatePreferences(updatePreferencesDto);

    const allowedFields = ['dashboardMetrics', 'notificationPreferences'];
    const sanitizedDto: any = {};

    for (const field of allowedFields) {
      if (field in updatePreferencesDto) {
        sanitizedDto[field] = updatePreferencesDto[field];
      }
    }

    const updated = await this.preferencesModel.findOneAndUpdate(
      { userId },
      { $set: sanitizedDto },
      { new: true, upsert: true, runValidators: true },
    );

    if (!updated) throw new Error('Failed to update user preferences');
    return updated;
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
      ...this.getDefaults(),
      createdAt: new Date(),
      updatedAt: new Date(),
    } as UserPreferences;
  }

  async resetToDefaults(userId: string): Promise<UserPreferences> {
    const defaults = this.getDefaults();

    return this.preferencesModel.findOneAndUpdate(
      { userId },
      { $set: defaults },
      { new: true, upsert: true, runValidators: true },
    );
  }

  async getSecurityAlertThreshold(userId: string): Promise<number> {
    const preferences = await this.getUserPreferences(userId);
    return preferences.notificationPreferences.securityAlertThreshold;
  }

  private validatePreferences(dto: UpdatePreferencesDto) {
    const { dashboardMetrics, notificationPreferences } = dto;

    if (dashboardMetrics) {
      for (const key in dashboardMetrics) {
        if (typeof dashboardMetrics[key] !== 'boolean') {
          throw new TypeError(`Invalid type for dashboardMetrics.${key}`);
        }
      }
    }

    if (notificationPreferences) {
      if (
        typeof notificationPreferences.emailNotifications !== 'boolean' ||
        typeof notificationPreferences.inAppNotifications !== 'boolean' ||
        typeof notificationPreferences.securityAlertThreshold !== 'number'
      ) {
        throw new TypeError('Invalid types in notificationPreferences');
      }
    }
  }
}
