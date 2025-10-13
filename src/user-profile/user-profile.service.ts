import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { UserProfile } from './user-profile.model';

@Injectable()
export class UserProfileService {
  constructor(
    @InjectModel(UserProfile.name) private userProfileModel: Model<UserProfile>,
  ) {}

  async updateProfile(
    userId: string,
    profileData: Partial<UserProfile>,
  ): Promise<UserProfile> {
    return this.userProfileModel
      .findByIdAndUpdate(userId, profileData, {
        new: true,
        upsert: true,
      })
      .exec();
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  parseResume(_buffer: Buffer): Partial<UserProfile> {
    // TODO: Implement actual parsing logic using the file buffer, e.g. with a resume parser library
    // For now, return mock data (replace with parsed data in production)
    return {
      name: 'John Doe',
      email: 'john.doe@example.com',
      linkedin_url: 'https://linkedin.com/in/johndoe',
    };
  }
}
