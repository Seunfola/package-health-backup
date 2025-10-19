import { UserProfileService } from './user-profile.service';
import { UserProfile } from './user-profile.model';
export declare class UserProfileController {
    private readonly userProfileService;
    constructor(userProfileService: UserProfileService);
    uploadResume(file: Express.Multer.File, userId: string): Promise<{
        message: string;
        data?: undefined;
    } | {
        message: string;
        data: UserProfile;
    }>;
    getAll(): Promise<UserProfile[]>;
    getOne(username: string): Promise<UserProfile>;
    create(body: Partial<UserProfile>): Promise<{
        message: string;
        data: UserProfile;
    }>;
    linkSocialProfile(body: {
        userId: string;
        platform: string;
        username: string;
    }): Promise<{
        message: string;
        data: UserProfile;
        error?: undefined;
    } | {
        message: string;
        error: string;
        data?: undefined;
    }>;
}
