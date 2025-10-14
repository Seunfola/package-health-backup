import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

@Schema({ timestamps: true })
export class UserProfile extends Document {
  @Prop({ required: false })
  name?: string;

  @Prop({ required: false, unique: true, lowercase: true, trim: true })
  email?: string;

  @Prop()
  profile_picture_url?: string;

  @Prop()
  bio?: string;

  @Prop()
  linkedin_url?: string;

  @Prop()
  github_url?: string;

  @Prop()
  twitter_url?: string;
}

export const UserProfileSchema = SchemaFactory.createForClass(UserProfile);
