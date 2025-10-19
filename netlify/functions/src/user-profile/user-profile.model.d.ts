import { Document } from 'mongoose';
export declare class UserProfile extends Document {
    name?: string;
    email?: string;
    profile_picture_url?: string;
    bio?: string;
    linkedin_url?: string;
    github_url?: string;
    twitter_url?: string;
}
export declare const UserProfileSchema: import("mongoose").Schema<UserProfile, import("mongoose").Model<UserProfile, any, any, any, Document<unknown, any, UserProfile, any, {}> & UserProfile & Required<{
    _id: unknown;
}> & {
    __v: number;
}, any>, {}, {}, {}, {}, import("mongoose").DefaultSchemaOptions, UserProfile, Document<unknown, {}, import("mongoose").FlatRecord<UserProfile>, {}, import("mongoose").ResolveSchemaOptions<import("mongoose").DefaultSchemaOptions>> & import("mongoose").FlatRecord<UserProfile> & Required<{
    _id: unknown;
}> & {
    __v: number;
}>;
