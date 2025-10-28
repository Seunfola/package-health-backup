import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

@Schema({ _id: false })
export class OverallHealth {
  @Prop({ type: Number, required: true })
  score!: number;

  @Prop({ type: String, required: true })
  label!: string;

  @Prop({
    type: {
      activity: { type: Number },
      security: { type: Number },
      maintenance: { type: Number },
      popularity: { type: Number },
      dependencies: { type: Number },
    },
  })
  metrics!: {
    security: number;
    performance: number;
    reliability: number;
    maintainability: number;
  };
}

export const OverallHealthSchema = SchemaFactory.createForClass(OverallHealth);

@Schema({ timestamps: true })
export class RepoHealth extends Document {
  @Prop({ required: true, unique: true })
  repo_id!: string;

  @Prop({ required: true })
  owner!: string;

  @Prop({ required: true })
  repo!: string;

  @Prop()
  name!: string;

  @Prop()
  stars!: number;

  @Prop()
  forks!: number;

  @Prop()
  open_issues!: number;

  @Prop()
  last_pushed!: Date;

  @Prop({ type: OverallHealthSchema })
  overall_health!: OverallHealth;

  @Prop()
  commit_activity!: number[];

  @Prop()
  security_alerts!: number;

  @Prop()
  dependency_health!: number;

  @Prop()
  risky_dependencies!: string[];

  @Prop()
  bundle_size!: number;

  @Prop({ type: [String] })
  license_risks!: string[];

  @Prop()
  popularity!: number;

  @Prop()
  days_behind!: number;
}

export const RepoHealthSchema = SchemaFactory.createForClass(RepoHealth);
export type RepoHealthDocument = RepoHealth & Document;
