"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.BulkOperationResponseDto = exports.ClearAllResponseDto = exports.MarkAllReadResponseDto = exports.NotificationSummaryResponseDto = exports.NotificationResponseDto = exports.NotificationQueryDto = exports.UpdateNotificationDto = exports.CreateNotificationDto = void 0;
const class_transformer_1 = require("class-transformer");
const class_validator_1 = require("class-validator");
const notification_constants_1 = require("./notification.constants");
class CreateNotificationDto {
    type;
    repository;
    repositoryUrl;
    title;
    description;
    priority;
    detailsUrl;
    read;
    metadata;
}
exports.CreateNotificationDto = CreateNotificationDto;
__decorate([
    (0, class_validator_1.IsIn)(notification_constants_1.NOTIFICATION_TYPES),
    __metadata("design:type", Object)
], CreateNotificationDto.prototype, "type", void 0);
__decorate([
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.Matches)(/^[a-zA-Z0-9_.-]+\/[a-zA-Z0-9_.-]+$/, {
        message: 'Repository must be in format "owner/repo"',
    }),
    __metadata("design:type", String)
], CreateNotificationDto.prototype, "repository", void 0);
__decorate([
    (0, class_validator_1.IsUrl)(),
    __metadata("design:type", String)
], CreateNotificationDto.prototype, "repositoryUrl", void 0);
__decorate([
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], CreateNotificationDto.prototype, "title", void 0);
__decorate([
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.IsOptional)(),
    __metadata("design:type", String)
], CreateNotificationDto.prototype, "description", void 0);
__decorate([
    (0, class_validator_1.IsIn)(notification_constants_1.NOTIFICATION_PRIORITIES),
    __metadata("design:type", Object)
], CreateNotificationDto.prototype, "priority", void 0);
__decorate([
    (0, class_validator_1.IsUrl)(),
    (0, class_validator_1.IsOptional)(),
    __metadata("design:type", String)
], CreateNotificationDto.prototype, "detailsUrl", void 0);
__decorate([
    (0, class_validator_1.IsBoolean)(),
    (0, class_validator_1.IsOptional)(),
    __metadata("design:type", Boolean)
], CreateNotificationDto.prototype, "read", void 0);
__decorate([
    (0, class_validator_1.IsObject)(),
    (0, class_validator_1.IsOptional)(),
    __metadata("design:type", Object)
], CreateNotificationDto.prototype, "metadata", void 0);
class UpdateNotificationDto {
    read;
    metadata;
}
exports.UpdateNotificationDto = UpdateNotificationDto;
__decorate([
    (0, class_validator_1.IsBoolean)(),
    (0, class_validator_1.IsOptional)(),
    __metadata("design:type", Boolean)
], UpdateNotificationDto.prototype, "read", void 0);
__decorate([
    (0, class_validator_1.IsObject)(),
    (0, class_validator_1.IsOptional)(),
    __metadata("design:type", Object)
], UpdateNotificationDto.prototype, "metadata", void 0);
class NotificationQueryDto {
    limit = 10;
    offset = 0;
    unreadOnly = false;
    type;
    priority;
}
exports.NotificationQueryDto = NotificationQueryDto;
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_transformer_1.Type)(() => Number),
    (0, class_validator_1.IsNumber)(),
    (0, class_validator_1.Min)(1),
    (0, class_validator_1.Max)(100),
    __metadata("design:type", Number)
], NotificationQueryDto.prototype, "limit", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_transformer_1.Type)(() => Number),
    (0, class_validator_1.IsNumber)(),
    (0, class_validator_1.Min)(0),
    __metadata("design:type", Number)
], NotificationQueryDto.prototype, "offset", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_transformer_1.Type)(() => Boolean),
    (0, class_validator_1.IsBoolean)(),
    __metadata("design:type", Boolean)
], NotificationQueryDto.prototype, "unreadOnly", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsIn)(notification_constants_1.NOTIFICATION_TYPES),
    __metadata("design:type", Object)
], NotificationQueryDto.prototype, "type", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsIn)(notification_constants_1.NOTIFICATION_PRIORITIES),
    __metadata("design:type", Object)
], NotificationQueryDto.prototype, "priority", void 0);
class NotificationResponseDto {
    _id;
    type;
    repository;
    repositoryUrl;
    title;
    description;
    priority;
    detailsUrl;
    read;
    createdAt;
    updatedAt;
    metadata;
    constructor(notification) {
        this._id = notification._id
            ? typeof notification._id === 'string'
                ? notification._id
                : notification._id.toString()
            : '';
        this.type = notification.type;
        this.repository = notification.repository;
        this.repositoryUrl = notification.repositoryUrl;
        this.title = notification.title;
        this.description = notification.description;
        this.priority = notification.priority;
        this.detailsUrl = notification.detailsUrl;
        this.read = notification.read;
        this.createdAt = notification.createdAt;
        this.updatedAt = notification.updatedAt;
        this.metadata = notification.metadata;
    }
}
exports.NotificationResponseDto = NotificationResponseDto;
class NotificationSummaryResponseDto {
    total;
    unread;
    byType;
    byPriority;
    constructor(summary) {
        this.total = summary.total;
        this.unread = summary.unread;
        this.byType = summary.byType;
        this.byPriority = summary.byPriority;
    }
}
exports.NotificationSummaryResponseDto = NotificationSummaryResponseDto;
class MarkAllReadResponseDto {
    modifiedCount;
    constructor(modifiedCount) {
        this.modifiedCount = modifiedCount;
    }
}
exports.MarkAllReadResponseDto = MarkAllReadResponseDto;
class ClearAllResponseDto {
    deletedCount;
    constructor(deletedCount) {
        this.deletedCount = deletedCount;
    }
}
exports.ClearAllResponseDto = ClearAllResponseDto;
class BulkOperationResponseDto {
    success;
    message;
    affectedIds;
    count;
    constructor(response) {
        this.success = response.success;
        this.message = response.message;
        this.affectedIds = response.affectedIds;
        this.count = response.count;
    }
}
exports.BulkOperationResponseDto = BulkOperationResponseDto;
//# sourceMappingURL=notification.dto.js.map