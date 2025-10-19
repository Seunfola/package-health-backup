import { Model } from 'mongoose';
import { UserPreferences } from './preferences.interface';
import { UpdatePreferencesDto } from './preferences.dto';
export declare class UserPreferencesService {
    private readonly preferencesModel;
    constructor(preferencesModel: Model<UserPreferences>);
    getUserPreferences(userId: string): Promise<UserPreferences>;
    updateUserPreferences(userId: string, updatePreferencesDto: UpdatePreferencesDto): Promise<UserPreferences>;
    shouldSendNotification(userId: string, notificationType: string): Promise<boolean>;
    getDefaults(): any;
    getDefaultPreferences(): UserPreferences;
    resetToDefaults(userId: string): Promise<UserPreferences>;
    getSecurityAlertThreshold(userId: string): Promise<number>;
}
