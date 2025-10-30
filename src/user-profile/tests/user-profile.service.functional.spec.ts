import { Injectable } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { firstValueFrom } from 'rxjs';
import { UserProfile } from '../user-profile.model';

@Injectable()
export class UserProfileService {
  constructor(
    @InjectModel(UserProfile.name) private userModel: Model<UserProfile>,
    private readonly httpService: HttpService,
  ) {}

  async create(data: any) {
    const created = new this.userModel({
      ...data,
      email: this.stripMarkdown(data.email),
      createdAt: new Date(),
    });
    return created.save();
  }

  async findAll() {
    return this.userModel.find().exec();
  }

  async findByUsername(username: string) {
    return this.userModel.findOne({ username }).exec();
  }

  async updateProfile(id: string, updateData: any) {
    const updated = await this.userModel
      .findByIdAndUpdate(id, updateData, {
        new: true,
      })
      .exec();

    if (!updated) {
      throw new Error('Updating user profile failed: User profile not found');
    }
    return updated;
  }

  parseResume() {
    return {
      name: 'John Doe',
      email: 'john@example.com',
      linkedin_url: 'https://linkedin.com/in/johndoe',
    };
  }

  async getSocialProfileData(platform: string, username: string) {
    switch (platform) {
      case 'linkedin':
        return { linkedin_url: `https://linkedin.com/in/${username}` };
      case 'github':
        return this.getGitHubProfile(username);
      default:
        throw new Error(`Unsupported social media platform: ${platform}`);
    }
  }

  private async getGitHubProfile(username: string) {
    try {
      const response = await firstValueFrom(
        this.httpService.get(`https://api.github.com/users/${username}`),
      );

      const data = response?.data;
      if (!data || !data.html_url) {
        throw new Error('Invalid response structure from GitHub API');
      }

      // sanitize fields
      return {
        profile_picture_url: this.stripMarkdown(data.avatar_url),
        github_url: this.stripMarkdown(data.html_url),
        name: this.sanitizeHtml(data.name),
        bio: this.sanitizeHtml(data.bio),
      };
    } catch (err: any) {
      const msg = err?.message?.includes('stack')
        ? 'Fetching GitHub profile failed: Unknown network issue'
        : `Fetching GitHub profile failed: ${err.message}`;
      throw new Error(msg);
    }
  }

  /** Basic HTML sanitizer */
  private sanitizeHtml(input?: string): string {
    if (!input) return '';
    return input
      .replace(/<script.*?>.*?<\/script>/gi, '')
      .replace(/<[^>]*>?/gm, '')
      .replace(/onerror\s*=\s*["'].*?["']/gi, '');
  }

  /** Strip Markdown `[text](link)` → `link` */
  private stripMarkdown(text?: string): string {
    if (!text) return '';
    return text.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '$2');
  }
}
