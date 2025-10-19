"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.NotificationSchema = void 0;
const mongoose_1 = require("mongoose");
const notification_constants_1 = require("./notification.constants");
exports.NotificationSchema = new mongoose_1.Schema({
    type: { type: String, enum: notification_constants_1.NOTIFICATION_TYPES, required: true },
    repository: { type: String, required: true },
    repositoryUrl: { type: String, required: true },
    title: { type: String, required: true },
    description: { type: String },
    priority: { type: String, enum: notification_constants_1.NOTIFICATION_PRIORITIES, required: true },
    detailsUrl: { type: String },
    read: { type: Boolean, default: false },
    metadata: { type: Object },
}, { timestamps: true });
//# sourceMappingURL=notification.model.js.map