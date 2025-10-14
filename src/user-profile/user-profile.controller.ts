import {
  Controller,
  Post,
  Body,
  UseInterceptors,
  UploadedFile,
  Param,
  Get,
  NotFoundException,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiTags, ApiOperation, ApiConsumes, ApiBody } from '@nestjs/swagger';
import { UserProfileService } from './user-profile.service';
import { UserProfile } from './user-profile.model';

@ApiTags('profile')
@Controller('profile')
export class UserProfileController {
  constructor(private readonly userProfileService: UserProfileService) {}

  // ✅ Upload resume and auto-update user profile
  @Post('upload-resume/:userId')
  @UseInterceptors(FileInterceptor('resume'))
  @ApiOperation({ summary: 'Upload a resume to update user profile' })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        resume: {
          type: 'string',
          format: 'binary',
        },
      },
    },
  })
  async uploadResume(
    @UploadedFile() file: Express.Multer.File,
    @Param('userId') userId: string,
  ) {
    if (!file) {
      return { message: 'No file uploaded.' };
    }

    // Simulate resume parsing -> update profile
    const parsedData = this.userProfileService.parseResume();
    const updatedProfile = await this.userProfileService.updateProfile(
      userId,
      parsedData,
    );

    return {
      message: 'Profile updated successfully!',
      data: updatedProfile,
    };
  }

  // ✅ Get all profiles
  @Get()
  @ApiOperation({ summary: 'Get all user profiles' })
  async getAll() {
    return this.userProfileService.findAll();
  }

  // ✅ Get one profile by username
  @Get(':username')
  @ApiOperation({ summary: 'Get a single user profile by username' })
  async getOne(@Param('username') username: string) {
    const user = await this.userProfileService.findByUsername(username);
    if (!user) {
      throw new NotFoundException(
        `User with username '${username}' not found.`,
      );
    }
    return user;
  }

  // ✅ Create a new user profile
  @Post()
  @ApiOperation({ summary: 'Create a new user profile' })
  async create(@Body() body: Partial<UserProfile>) {
    const newUser = await this.userProfileService.create(body);
    return {
      message: 'User profile created successfully!',
      data: newUser,
    };
  }

  // ✅ Link a social media profile (GitHub, LinkedIn, etc.)
  @Post('link-social')
  @ApiOperation({ summary: 'Link a social profile (e.g., GitHub, LinkedIn)' })
  async linkSocialProfile(
    @Body()
    body: {
      userId: string;
      platform: string;
      username: string;
    },
  ) {
    try {
      const { userId, platform, username } = body;

      // Fetch social data from service
      const socialData = await this.userProfileService.getSocialProfileData(
        platform,
        username,
      );

      const updatedProfile = await this.userProfileService.updateProfile(
        userId,
        socialData,
      );

      return {
        message: 'Social profile linked successfully!',
        data: updatedProfile,
      };
    } catch (error) {
      return {
        message: 'Failed to link social profile.',
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }
}
