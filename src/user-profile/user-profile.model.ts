import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

@Schema()
export class UserProfile extends Document {
  @Prop({ required: false })
  name?: string;

  @Prop({ required: false, unique: true })
  email?: string;

  @Prop({ required: false })
  profile_picture_url?: string;

  @Prop({ required: false })
  linkedin_url?: string;

  @Prop({ required: false })
  github_url?: string;

  @Prop({ required: false })
  twitter_url?: string;
}

export const UserProfileSchema = SchemaFactory.createForClass(UserProfile);
