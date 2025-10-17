import {
  Controller,
  Get,
  Put,
  Body,
  Request,
  UseGuards,
  Post,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { UserPreferencesService } from './preferences.service';
import {
  UpdatePreferencesDto,
  PreferencesResponseDto,
} from './preferences.dto';

interface AuthenticatedRequest {
  user: {
    id: string;
  };
}

@Controller('user/preferences')
@UseGuards(JwtAuthGuard)
export class UserPreferencesController {
  constructor(private readonly preferencesService: UserPreferencesService) {}

  @Get('defaults')
  getDefaultPreferences(): PreferencesResponseDto {
    try {
      const defaults = this.preferencesService.getDefaultPreferences();
      return new PreferencesResponseDto(defaults);
    } catch (error: unknown) {
      if (error instanceof Error) {
        throw new HttpException(
          error.message,
          HttpStatus.INTERNAL_SERVER_ERROR,
        );
      }
      throw new HttpException(
        'Failed to fetch default preferences',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @Post('reset')
  async resetPreferences(
    @Request() req: AuthenticatedRequest,
  ): Promise<PreferencesResponseDto> {
    try {
      const userId = req.user.id;
      const preferences = await this.preferencesService.resetToDefaults(userId);
      return new PreferencesResponseDto(preferences);
    } catch (error: unknown) {
      const message =
        error instanceof Error ? error.message : 'Failed to reset preferences';
      throw new HttpException(message, HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  @Get()
  async getPreferences(
    @Request() req: AuthenticatedRequest,
  ): Promise<PreferencesResponseDto> {
    try {
      const userId = req.user.id;
      const preferences =
        await this.preferencesService.getUserPreferences(userId);
      return new PreferencesResponseDto(preferences);
    } catch (error: unknown) {
      const message =
        error instanceof Error ? error.message : 'Failed to fetch preferences';
      throw new HttpException(message, HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  @Put()
  async updatePreferences(
    @Request() req: AuthenticatedRequest,
    @Body() updatePreferencesDto: UpdatePreferencesDto,
  ): Promise<PreferencesResponseDto> {
    try {
      const userId = req.user.id;

      const preferences = await this.preferencesService.updateUserPreferences(
        userId,
        updatePreferencesDto,
      );
      return new PreferencesResponseDto(preferences);
    } catch (error: unknown) {
      const message =
        error instanceof Error ? error.message : 'Failed to update preferences';
      throw new HttpException(message, HttpStatus.BAD_REQUEST);
    }
  }
}
