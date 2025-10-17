import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { UserPreferencesService } from './preferences.service';
import { UserPreferencesController } from './preferences.controller';
import { UserPreferencesSchema } from './preferences.schema';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: 'UserPreferences', schema: UserPreferencesSchema },
    ]),
  ],
  controllers: [UserPreferencesController],
  providers: [UserPreferencesService],
  exports: [UserPreferencesService],
})
export class UserPreferencesModule {}
