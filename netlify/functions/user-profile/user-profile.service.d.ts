import { Model } from 'mongoose';
import { HttpService } from '@nestjs/axios';
import { UserProfile } from './user-profile.model';
export declare class UserProfileService {
    private readonly userProfileModel;
    private readonly httpService;
    constructor(userProfileModel: Model<UserProfile>, httpService: HttpService);
    create(data: Partial<UserProfile>): Promise<UserProfile>;
    findByUsername(username: string): Promise<UserProfile | null>;
    findAll(): Promise<UserProfile[]>;
    updateProfile(userId: string, profileData: Partial<UserProfile>): Promise<UserProfile>;
    parseResume(): Partial<UserProfile>;
    getSocialProfileData(platform: string, username: string): Promise<Partial<UserProfile>>;
    private getGitHubProfile;
    private handleError;
}
