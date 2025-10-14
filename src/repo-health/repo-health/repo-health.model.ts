import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

@Schema({ timestamps: true })
export class RepoHealth extends Document {
  @Prop({ required: true, unique: true })
  repo_id: string; // Composite key for owner/repo

  @Prop({ required: true })
  owner: string;

  @Prop({ required: true })
  repo: string;

  @Prop()
  name: string;

  @Prop()
  stars: number;

  @Prop()
  forks: number;

  @Prop()
  open_issues: number;

  @Prop()
  last_pushed: Date;

  @Prop()
  overall_health: number;

  // Additional fields for more detailed analysis
  @Prop()
  commit_activity: number[];

  @Prop()
  security_alerts: number;

  @Prop()
  dependency_health: number;

  @Prop()
  risky_dependencies: string[];

  @Prop({ expires: 604800 })
  createdAt: Date;
}

export const RepoHealthSchema = SchemaFactory.createForClass(RepoHealth);
export type RepoHealthDocument = RepoHealth & Document;
