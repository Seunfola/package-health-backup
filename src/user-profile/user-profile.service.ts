import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { lastValueFrom } from 'rxjs';
import { HttpService } from '@nestjs/axios';
import { UserProfile } from './user-profile.model';

interface GitHubApiResponse {
  avatar_url?: string;
  html_url?: string;
  name?: string;
  bio?: string;
  [key: string]: unknown;
}

@Injectable()
export class UserProfileService {
  constructor(
    @InjectModel(UserProfile.name)
    private readonly userProfileModel: Model<UserProfile>,
    private readonly httpService: HttpService,
  ) {}

  async create(data: Partial<UserProfile>): Promise<UserProfile> {
    const newUser = new this.userProfileModel(data);
    return await newUser.save();
  }

  async findByUsername(username: string): Promise<UserProfile | null> {
    return this.userProfileModel.findOne({ username }).exec();
  }

  async findAll(): Promise<UserProfile[]> {
    return this.userProfileModel.find().exec();
  }

  async updateProfile(
    userId: string,
    profileData: Partial<UserProfile>,
  ): Promise<UserProfile> {
    try {
      const updatedProfile = await this.userProfileModel
        .findByIdAndUpdate(userId, profileData, {
          new: true,
          upsert: true,
        })
        .exec();

      if (!updatedProfile) {
        throw new Error('User profile not found or failed to update');
      }

      return updatedProfile;
    } catch (error: unknown) {
      this.handleError('Updating user profile', error);
    }
  }

  parseResume(): Partial<UserProfile> {
    console.log('Parsing resume...');
    return {
      name: 'John Doe',
      email: 'john.doe@example.com',
      linkedin_url: 'https://linkedin.com/in/johndoe',
    };
  }

  async getSocialProfileData(
    platform: string,
    username: string,
  ): Promise<Partial<UserProfile>> {
    try {
      switch (platform.toLowerCase()) {
        case 'github':
          return this.getGitHubProfile(username);
        case 'linkedin':
          return { linkedin_url: `https://linkedin.com/in/${username}` };
        default:
          throw new Error(`Unsupported social media platform: ${platform}`);
      }
    } catch (error: unknown) {
      this.handleError(`Fetching ${platform} profile`, error);
    }
  }

  private async getGitHubProfile(
    username: string,
  ): Promise<Partial<UserProfile>> {
    const GITHUB_API_URL = `https://api.github.com/users/${username}`;

    try {
      const response = await lastValueFrom(
        this.httpService.get<GitHubApiResponse>(GITHUB_API_URL),
      );

      const data = response?.data;
      if (!data || typeof data !== 'object') {
        throw new Error('Invalid response structure from GitHub API');
      }

      const { avatar_url = '', html_url = '', name = '', bio = '' } = data;

      return {
        profile_picture_url: avatar_url,
        github_url: html_url,
        name,
        bio,
      };
    } catch (error: unknown) {
      this.handleError('Fetching GitHub profile', error);
    }
  }

  private handleError(context: string, error: unknown): never {
    if (error instanceof Error) {
      console.error(`${context} failed:`, error.message);
      throw new Error(`${context} failed: ${error.message}`);
    }

    console.error(`${context} failed with unknown error:`, error);
    throw new Error(`${context} failed with unknown error`);
  }
}
