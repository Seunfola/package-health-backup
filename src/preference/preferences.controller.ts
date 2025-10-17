// preferences.controller.ts
import { Controller, Get, Put, Body, Request, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { UserPreferencesService } from './preferences.service';
import {
  UpdatePreferencesDto,
  PreferencesResponseDto,
} from './preferences.dto';

@Controller('user/preferences')
@UseGuards(JwtAuthGuard)
export class UserPreferencesController {
  constructor(private readonly preferencesService: UserPreferencesService) {}

  @Get()
  async getPreferences(@Request() req: { user: { id: string } }) {
    const userId = req?.user?.id;
    const preferences =
      await this.preferencesService.getUserPreferences(userId);
    return new PreferencesResponseDto(preferences);
  }

  @Put()
  async updatePreferences(
    @Request() req,
    @Body() updatePreferencesDto: UpdatePreferencesDto,
  ) {
    const userId: string | undefined = (req as { user?: { id?: string } })?.user
      ?.id;
    if (!userId) {
      throw new Error('User id is missing in the request');
    }
    const preferences = await this.preferencesService.updateUserPreferences(
      userId,
      updatePreferencesDto,
    );
    return new PreferencesResponseDto(preferences);
  }
}
