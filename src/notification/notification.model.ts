import { Schema } from 'mongoose';
import {
  NOTIFICATION_TYPES,
  NOTIFICATION_PRIORITIES,
} from './notification.constants';

export const NotificationSchema = new Schema(
  {
    type: { type: String, enum: NOTIFICATION_TYPES, required: true },
    repository: { type: String, required: true },
    repositoryUrl: { type: String, required: true },
    title: { type: String, required: true },
    description: { type: String },
    priority: { type: String, enum: NOTIFICATION_PRIORITIES, required: true },
    detailsUrl: { type: String },
    read: { type: Boolean, default: false },
    metadata: { type: Object },
  },
  { timestamps: true },
);
