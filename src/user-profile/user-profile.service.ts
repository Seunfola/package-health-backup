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
    const newUser = new this.userProfileModel({
      ...data,
      email: this.stripMarkdown(data.email),
      createdAt: new Date(),
    });
    return newUser.save();
  }

  async findAll(): Promise<UserProfile[]> {
    return this.userProfileModel.find().exec();
  }

  async findByUsername(username: string): Promise<UserProfile | null> {
    return this.userProfileModel.findOne({ username }).exec();
  }

  async updateProfile(
    userId: string,
    profileData: Partial<UserProfile>,
  ): Promise<UserProfile> {
    try {
      const updated = await this.userProfileModel
        .findByIdAndUpdate(userId, profileData, { new: true, upsert: true })
        .exec();

      if (!updated)
        throw new Error('User profile not found or failed to update');
      return updated;
    } catch (error: unknown) {
      this.handleError('Updating user profile', error);
    }
  }

  parseResume(): Partial<UserProfile> {
    return {
      name: 'John Doe',
      email: 'john@example.com',
      linkedin_url: 'https://linkedin.com/in/johndoe',
    };
  }

  async getSocialProfileData(
    platform: string,
    username: string,
  ): Promise<Partial<UserProfile>> {
    try {
      switch (platform.toLowerCase()) {
        case 'linkedin':
          return { linkedin_url: `https://linkedin.com/in/${username}` };
        case 'github':
          return this.getGitHubProfile(username);
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
    try {
      const response = await lastValueFrom(
        this.httpService.get<GitHubApiResponse>(
          `https://api.github.com/users/${username}`,
        ),
      );

      const data = response?.data;
      if (!data || typeof data !== 'object' || Array.isArray(data))
        throw new Error('Invalid response from GitHub API');

      return {
        profile_picture_url: this.stripMarkdown(data.avatar_url),
        github_url: this.stripMarkdown(data.html_url),
        name: this.sanitizeHtml(data.name),
        bio: this.sanitizeHtml(data.bio),
      };
    } catch (error: unknown) {
      this.handleError('Fetching GitHub profile', error);
    }
  }

  private stripMarkdown(text?: string): string {
    if (!text) return '';
    return text.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '$2');
  }

  private sanitizeHtml(input?: string): string {
    if (!input) return '';
    return input
      .replace(/<script.*?>.*?<\/script>/gi, '')
      .replace(/<[^>]*>?/gm, '')
      .replace(/onerror\s*=\s*["'].*?["']/gi, '');
  }

  private handleError(context: string, error: unknown): never {
    const message =
      error instanceof Error
        ? `${context} failed: ${error.message}`
        : `${context} failed with unknown error`;

    if (process.env.NODE_ENV !== 'test') console.error(message);
    throw new Error(message);
  }
}
