import {
  Controller,
  Post,
  UseInterceptors,
  UploadedFile,
  Param,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiTags, ApiOperation, ApiConsumes, ApiBody } from '@nestjs/swagger';
import { UserProfileService } from './user-profile.service';

@ApiTags('profile')
@Controller('profile')
export class UserProfileController {
  constructor(private readonly userProfileService: UserProfileService) {}

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

    const parsedData = this.userProfileService.parseResume(file.buffer);
    const updatedProfile = await this.userProfileService.updateProfile(
      userId,
      parsedData,
    );

    return { message: 'Profile updated successfully!', data: updatedProfile };
  }
}
