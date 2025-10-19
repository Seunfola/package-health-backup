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
var __param = (this && this.__param) || function (paramIndex, decorator) {
    return function (target, key) { decorator(target, key, paramIndex); }
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.NotificationController = void 0;
const common_1 = require("@nestjs/common");
const notification_service_1 = require("./notification.service");
const notification_dto_1 = require("./notification.dto");
const jwt_auth_guard_1 = require("../auth/jwt-auth.guard");
let NotificationController = class NotificationController {
    notificationService;
    constructor(notificationService) {
        this.notificationService = notificationService;
    }
    async getNotifications(query) {
        try {
            return await this.notificationService.getUserNotifications(query);
        }
        catch (error) {
            const message = error instanceof Error
                ? error.message
                : 'Failed to fetch notifications';
            throw new common_1.HttpException(message, common_1.HttpStatus.INTERNAL_SERVER_ERROR);
        }
    }
    async getNotificationById(id) {
        try {
            return await this.notificationService.getNotificationById(id);
        }
        catch (error) {
            const message = error instanceof Error ? error.message : 'Failed to fetch notification';
            const status = message.toLowerCase().includes('not found')
                ? common_1.HttpStatus.NOT_FOUND
                : common_1.HttpStatus.BAD_REQUEST;
            throw new common_1.HttpException(message, status);
        }
    }
    async getSummary() {
        try {
            return await this.notificationService.getNotificationSummary();
        }
        catch (error) {
            const message = error instanceof Error ? error.message : 'Failed to get summary';
            throw new common_1.HttpException(message, common_1.HttpStatus.INTERNAL_SERVER_ERROR);
        }
    }
    async getUnreadCount() {
        try {
            return await this.notificationService.getUnreadCount();
        }
        catch (error) {
            const message = error instanceof Error ? error.message : 'Failed to get unread count';
            throw new common_1.HttpException(message, common_1.HttpStatus.INTERNAL_SERVER_ERROR);
        }
    }
    async getNotificationsByRepository(repository) {
        try {
            return await this.notificationService.getNotificationsByRepository(repository);
        }
        catch (error) {
            const message = error instanceof Error
                ? error.message
                : 'Failed to fetch repository notifications';
            throw new common_1.HttpException(message, common_1.HttpStatus.INTERNAL_SERVER_ERROR);
        }
    }
    async searchNotifications(searchTerm, query) {
        try {
            return await this.notificationService.searchNotifications(searchTerm, query);
        }
        catch (error) {
            const message = error instanceof Error
                ? error.message
                : 'Failed to search notifications';
            throw new common_1.HttpException(message, common_1.HttpStatus.INTERNAL_SERVER_ERROR);
        }
    }
    async createNotification(createNotificationDto) {
        try {
            return await this.notificationService.createNotification(createNotificationDto);
        }
        catch (error) {
            const message = error instanceof Error
                ? error.message
                : 'Failed to create notification';
            throw new common_1.HttpException(message, common_1.HttpStatus.BAD_REQUEST);
        }
    }
    async generateNotifications(owner, repo, req) {
        try {
            const notifications = await this.notificationService.generateNotificationsForRepo(owner, repo, req.user?.id);
            return {
                generated: notifications.length,
                notifications,
            };
        }
        catch (error) {
            const message = error instanceof Error
                ? error.message
                : 'Failed to generate notifications';
            throw new common_1.HttpException(message, common_1.HttpStatus.INTERNAL_SERVER_ERROR);
        }
    }
    async markAsRead(id) {
        try {
            const notification = await this.notificationService.markAsRead(id);
            if (!notification) {
                throw new common_1.HttpException('Notification not found', common_1.HttpStatus.NOT_FOUND);
            }
            return notification;
        }
        catch (error) {
            const message = error instanceof Error ? error.message : 'Notification not found';
            const status = message.toLowerCase().includes('not found')
                ? common_1.HttpStatus.NOT_FOUND
                : common_1.HttpStatus.BAD_REQUEST;
            throw new common_1.HttpException(message, status);
        }
    }
    async markMultipleAsRead(body) {
        try {
            return await this.notificationService.markMultipleAsRead(body.notificationIds);
        }
        catch (error) {
            const message = error instanceof Error
                ? error.message
                : 'Failed to mark notifications as read';
            throw new common_1.HttpException(message, common_1.HttpStatus.BAD_REQUEST);
        }
    }
    async markAllAsRead() {
        try {
            return await this.notificationService.markAllAsRead();
        }
        catch (error) {
            const message = error instanceof Error ? error.message : 'Failed to mark all as read';
            throw new common_1.HttpException(message, common_1.HttpStatus.INTERNAL_SERVER_ERROR);
        }
    }
    async updateNotification(id, updateNotificationDto) {
        try {
            return await this.notificationService.updateNotification(id, updateNotificationDto);
        }
        catch (error) {
            const message = error instanceof Error
                ? error.message
                : 'Failed to update notification';
            const status = message.toLowerCase().includes('not found')
                ? common_1.HttpStatus.NOT_FOUND
                : common_1.HttpStatus.BAD_REQUEST;
            throw new common_1.HttpException(message, status);
        }
    }
    async deleteNotification(id) {
        try {
            await this.notificationService.deleteNotification(id);
            return { message: 'Notification deleted successfully' };
        }
        catch (error) {
            const message = error instanceof Error ? error.message : 'Notification not found';
            const status = message.includes('not found')
                ? common_1.HttpStatus.NOT_FOUND
                : common_1.HttpStatus.BAD_REQUEST;
            throw new common_1.HttpException(message, status);
        }
    }
    async deleteMultipleNotifications(body) {
        try {
            return await this.notificationService.deleteMultipleNotifications(body.notificationIds);
        }
        catch (error) {
            const message = error instanceof Error
                ? error.message
                : 'Failed to delete notifications';
            throw new common_1.HttpException(message, common_1.HttpStatus.BAD_REQUEST);
        }
    }
    async clearAllNotifications() {
        try {
            return await this.notificationService.clearAllNotifications();
        }
        catch (error) {
            const message = error instanceof Error
                ? error.message
                : 'Failed to clear notifications';
            throw new common_1.HttpException(message, common_1.HttpStatus.INTERNAL_SERVER_ERROR);
        }
    }
    async cleanupOldNotifications(days) {
        try {
            const daysOld = days ? parseInt(days, 10) : 30;
            return await this.notificationService.cleanupOldNotifications(daysOld);
        }
        catch (error) {
            const message = error instanceof Error
                ? error.message
                : 'Failed to cleanup notifications';
            throw new common_1.HttpException(message, common_1.HttpStatus.INTERNAL_SERVER_ERROR);
        }
    }
};
exports.NotificationController = NotificationController;
__decorate([
    (0, common_1.Get)(),
    __param(0, (0, common_1.Query)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [notification_dto_1.NotificationQueryDto]),
    __metadata("design:returntype", Promise)
], NotificationController.prototype, "getNotifications", null);
__decorate([
    (0, common_1.Get)(':id'),
    __param(0, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", Promise)
], NotificationController.prototype, "getNotificationById", null);
__decorate([
    (0, common_1.Get)('summary'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", Promise)
], NotificationController.prototype, "getSummary", null);
__decorate([
    (0, common_1.Get)('stats/unread'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", Promise)
], NotificationController.prototype, "getUnreadCount", null);
__decorate([
    (0, common_1.Get)('repository/:repository'),
    __param(0, (0, common_1.Param)('repository')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", Promise)
], NotificationController.prototype, "getNotificationsByRepository", null);
__decorate([
    (0, common_1.Get)('search/:term'),
    __param(0, (0, common_1.Param)('term')),
    __param(1, (0, common_1.Query)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, notification_dto_1.NotificationQueryDto]),
    __metadata("design:returntype", Promise)
], NotificationController.prototype, "searchNotifications", null);
__decorate([
    (0, common_1.Post)(),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [notification_dto_1.CreateNotificationDto]),
    __metadata("design:returntype", Promise)
], NotificationController.prototype, "createNotification", null);
__decorate([
    (0, common_1.Post)('generate/:owner/:repo'),
    (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard),
    __param(0, (0, common_1.Param)('owner')),
    __param(1, (0, common_1.Param)('repo')),
    __param(2, (0, common_1.Request)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String, Object]),
    __metadata("design:returntype", Promise)
], NotificationController.prototype, "generateNotifications", null);
__decorate([
    (0, common_1.Post)(':id/read'),
    __param(0, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", Promise)
], NotificationController.prototype, "markAsRead", null);
__decorate([
    (0, common_1.Post)('mark-read'),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], NotificationController.prototype, "markMultipleAsRead", null);
__decorate([
    (0, common_1.Post)('read-all'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", Promise)
], NotificationController.prototype, "markAllAsRead", null);
__decorate([
    (0, common_1.Put)(':id'),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, notification_dto_1.UpdateNotificationDto]),
    __metadata("design:returntype", Promise)
], NotificationController.prototype, "updateNotification", null);
__decorate([
    (0, common_1.Delete)(':id'),
    __param(0, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", Promise)
], NotificationController.prototype, "deleteNotification", null);
__decorate([
    (0, common_1.Delete)('bulk/delete'),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], NotificationController.prototype, "deleteMultipleNotifications", null);
__decorate([
    (0, common_1.Delete)(),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", Promise)
], NotificationController.prototype, "clearAllNotifications", null);
__decorate([
    (0, common_1.Post)('cleanup'),
    __param(0, (0, common_1.Query)('days')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", Promise)
], NotificationController.prototype, "cleanupOldNotifications", null);
exports.NotificationController = NotificationController = __decorate([
    (0, common_1.Controller)('notifications'),
    (0, common_1.UsePipes)(new common_1.ValidationPipe({ transform: true })),
    __metadata("design:paramtypes", [notification_service_1.NotificationService])
], NotificationController);
//# sourceMappingURL=notification.controller.js.map