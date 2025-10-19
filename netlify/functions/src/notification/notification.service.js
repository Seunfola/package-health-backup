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
var NotificationService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.NotificationService = void 0;
const common_1 = require("@nestjs/common");
const mongoose_1 = require("@nestjs/mongoose");
const mongoose_2 = require("mongoose");
const repo_health_service_1 = require("../repo-health/repo-health/repo-health.service");
const notification_constants_1 = require("./notification.constants");
const notification_dto_1 = require("./notification.dto");
const preferences_service_1 = require("../preference/preferences.service");
const cache_manager_1 = require("@nestjs/cache-manager");
let NotificationService = NotificationService_1 = class NotificationService {
    notificationModel;
    repoHealthService;
    userPreferencesService;
    cacheManager;
    logger = new common_1.Logger(NotificationService_1.name);
    constructor(notificationModel, repoHealthService, userPreferencesService, cacheManager) {
        this.notificationModel = notificationModel;
        this.repoHealthService = repoHealthService;
        this.userPreferencesService = userPreferencesService;
        this.cacheManager = cacheManager;
    }
    async generateNotificationsForRepo(owner, repo, userId) {
        const notifications = [];
        const repoUrl = `https://github.com/${owner}/${repo}`;
        const repoId = `${owner}/${repo}`;
        try {
            const healthData = await this.repoHealthService.findRepoHealth(owner, repo);
            let userPreferences = null;
            if (userId) {
                userPreferences =
                    await this.userPreferencesService.getUserPreferences(userId);
            }
            if (healthData.security_alerts > 0) {
                const shouldShowSecurityAlert = !userPreferences || userPreferences.dashboardMetrics.securityAlerts;
                if (shouldShowSecurityAlert) {
                    notifications.push({
                        type: 'SECURITY_VULNERABILITY',
                        repository: repoId,
                        repositoryUrl: repoUrl,
                        title: `Security Alert: ${healthData.security_alerts} vulnerability(s) detected`,
                        description: `Your repository has ${healthData.security_alerts} security vulnerability(s) that need attention.`,
                        priority: healthData.security_alerts > 5 ? 'critical' : 'high',
                        detailsUrl: `${repoUrl}/security/advisories`,
                        read: false,
                        metadata: {
                            alertCount: healthData.security_alerts,
                            lastScanned: healthData.last_pushed,
                            userId: userId,
                        },
                    });
                }
            }
            if (healthData.dependency_health < 70) {
                const shouldShowDependencyAlert = !userPreferences ||
                    userPreferences.dashboardMetrics.dependencyVulnerabilities;
                if (shouldShowDependencyAlert) {
                    const priority = healthData.dependency_health < 40 ? 'high' : 'medium';
                    notifications.push({
                        type: 'DEPENDENCY_UPDATE',
                        repository: repoId,
                        repositoryUrl: repoUrl,
                        title: `Dependency Health: ${healthData.dependency_health}% - Needs Improvement`,
                        description: `Your dependencies are ${100 - healthData.dependency_health}% below optimal health. Consider updating outdated packages.`,
                        priority,
                        detailsUrl: `${repoUrl}/network/dependencies`,
                        read: false,
                        metadata: {
                            healthScore: healthData.dependency_health,
                            riskyDependencies: healthData.risky_dependencies || [],
                            userId: userId,
                        },
                    });
                }
            }
            let overallScore = null;
            let overallLabel;
            if (typeof healthData.overall_health === 'number') {
                overallScore = healthData.overall_health;
                overallLabel =
                    overallScore >= 80
                        ? 'Excellent'
                        : overallScore >= 60
                            ? 'Good'
                            : overallScore >= 40
                                ? 'Moderate'
                                : 'Poor';
            }
            else if (healthData.overall_health &&
                typeof healthData.overall_health === 'object' &&
                healthData.overall_health !== null) {
                const healthObj = healthData.overall_health;
                overallScore =
                    typeof healthObj.score === 'number' ? healthObj.score : null;
                overallLabel =
                    typeof healthObj.label === 'string' ? healthObj.label : undefined;
            }
            if (overallScore !== null && overallScore < 60) {
                const shouldShowHealthAlert = !userPreferences || userPreferences.dashboardMetrics.codeQualityScore;
                if (shouldShowHealthAlert) {
                    notifications.push({
                        type: 'SYSTEM_ALERT',
                        repository: repoId,
                        repositoryUrl: repoUrl,
                        title: `Repository Health: ${overallScore}% - ${overallLabel ?? 'Needs Improvement'}`,
                        description: `Your repository health score indicates areas that need improvement for better maintainability and security.`,
                        priority: overallScore < 40 ? 'high' : 'medium',
                        detailsUrl: repoUrl,
                        read: false,
                        metadata: {
                            healthScore: overallScore,
                            healthLabel: overallLabel,
                            userId: userId,
                        },
                    });
                }
            }
            const lastPushed = new Date(healthData.last_pushed);
            const daysSinceLastPush = (Date.now() - lastPushed.getTime()) / (1000 * 60 * 60 * 24);
            if (daysSinceLastPush > 90) {
                notifications.push({
                    type: 'SYSTEM_ALERT',
                    repository: repoId,
                    repositoryUrl: repoUrl,
                    title: 'Repository Inactivity Alert',
                    description: `This repository hasn't been updated in ${Math.floor(daysSinceLastPush)} days. Consider archiving if no longer maintained.`,
                    priority: 'low',
                    detailsUrl: repoUrl,
                    read: false,
                    metadata: {
                        daysSinceLastPush: Math.floor(daysSinceLastPush),
                        lastPushDate: lastPushed,
                        userId: userId,
                    },
                });
            }
            if (notifications.length > 0) {
                const saved = await this.notificationModel.insertMany(notifications);
                if (userId) {
                    await this.sendNotificationsBasedOnPreferences(userId, saved);
                }
                return saved.map((n) => new notification_dto_1.NotificationResponseDto(n.toObject()));
            }
        }
        catch (err) {
            const message = err instanceof Error ? err.message : 'Unknown error';
            this.logger.error(`Failed to generate notifications for ${repoId}: ${message}`);
            throw new common_1.BadRequestException(`Failed to generate notifications: ${message}`);
        }
        return [];
    }
    async getUserNotifications(options) {
        const { type, priority, unreadOnly, offset = 0, limit = 20, } = options ?? {};
        const query = {};
        if (unreadOnly)
            query.read = false;
        if (type)
            query.type = type;
        if (priority)
            query.priority = priority;
        try {
            const notifications = await this.notificationModel
                .find(query)
                .sort({ createdAt: -1 })
                .skip(Math.max(offset, 0))
                .limit(Math.min(Math.max(limit, 1), 100))
                .lean()
                .exec();
            return notifications.map((n) => new notification_dto_1.NotificationResponseDto(n));
        }
        catch (err) {
            const message = err instanceof Error ? err.message : 'Unknown error';
            this.logger.error(`Failed to fetch notifications: ${message}`, { query });
            throw new common_1.BadRequestException(`Failed to fetch notifications: ${message}`);
        }
    }
    async getNotificationSummary() {
        const cacheKey = 'notification:summary';
        const cached = await this.cacheManager.get(cacheKey);
        if (cached)
            return cached;
        try {
            const [total, unread, byTypeRaw, byPriorityRaw] = await Promise.all([
                this.notificationModel.countDocuments(),
                this.notificationModel.countDocuments({ read: false }),
                this.notificationModel.aggregate([
                    { $group: { _id: '$type', count: { $sum: 1 } } },
                ]),
                this.notificationModel.aggregate([
                    { $group: { _id: '$priority', count: { $sum: 1 } } },
                ]),
            ]);
            const byType = {
                SECURITY_VULNERABILITY: 0,
                DEPENDENCY_UPDATE: 0,
                NEW_ISSUE: 0,
                PULL_REQUEST: 0,
                SYSTEM_ALERT: 0,
            };
            byTypeRaw.forEach((item) => {
                if (this.isValidNotificationType(item._id)) {
                    byType[item._id] = item.count;
                }
            });
            const byPriority = {
                low: 0,
                medium: 0,
                high: 0,
                critical: 0,
            };
            byPriorityRaw.forEach((item) => {
                if (this.isValidNotificationPriority(item._id)) {
                    byPriority[item._id] = item.count;
                }
            });
            const summary = { total, unread, byType, byPriority };
            await this.cacheManager.set(cacheKey, summary, 60 * 2);
            return summary;
        }
        catch (err) {
            const message = err instanceof Error ? err.message : 'Unknown error';
            this.logger.error('Failed to get notification summary', { message });
            throw new common_1.BadRequestException('Failed to get notification summary');
        }
    }
    isValidNotificationType(type) {
        return notification_constants_1.NOTIFICATION_TYPES.includes(type);
    }
    isValidNotificationPriority(priority) {
        return notification_constants_1.NOTIFICATION_PRIORITIES.includes(priority);
    }
    async markAsRead(notificationId) {
        if (!mongoose_2.Types.ObjectId.isValid(notificationId)) {
            throw new common_1.BadRequestException('Invalid notification ID');
        }
        const notification = await this.notificationModel
            .findByIdAndUpdate(notificationId, { read: true }, { new: true })
            .lean()
            .exec();
        if (!notification) {
            throw new common_1.NotFoundException(`Notification with ID ${notificationId} not found`);
        }
        return new notification_dto_1.NotificationResponseDto(notification);
    }
    async markAllAsRead() {
        const result = await this.notificationModel
            .updateMany({ read: false }, { read: true })
            .exec();
        return { modifiedCount: result.modifiedCount };
    }
    async deleteNotification(notificationId) {
        if (!mongoose_2.Types.ObjectId.isValid(notificationId)) {
            throw new common_1.BadRequestException('Invalid notification ID');
        }
        const result = await this.notificationModel
            .findByIdAndDelete(notificationId)
            .exec();
        if (!result) {
            throw new common_1.NotFoundException(`Notification with ID ${notificationId} not found`);
        }
    }
    async clearAllNotifications() {
        const result = await this.notificationModel.deleteMany({}).exec();
        return { deletedCount: result.deletedCount };
    }
    async createNotification(dto) {
        const notification = new this.notificationModel({
            ...dto,
            createdAt: new Date(),
        });
        const saved = await notification.save();
        return new notification_dto_1.NotificationResponseDto(saved.toObject());
    }
    async updateNotification(notificationId, dto) {
        if (!mongoose_2.Types.ObjectId.isValid(notificationId)) {
            throw new common_1.BadRequestException('Invalid notification ID');
        }
        const notification = await this.notificationModel
            .findByIdAndUpdate(notificationId, dto, { new: true })
            .lean()
            .exec();
        if (!notification) {
            throw new common_1.NotFoundException(`Notification with ID ${notificationId} not found`);
        }
        return new notification_dto_1.NotificationResponseDto(notification);
    }
    async getNotificationById(notificationId) {
        if (!mongoose_2.Types.ObjectId.isValid(notificationId)) {
            throw new common_1.BadRequestException('Invalid notification ID');
        }
        const notification = await this.notificationModel
            .findById(notificationId)
            .lean()
            .exec();
        if (!notification) {
            throw new common_1.NotFoundException(`Notification with ID ${notificationId} not found`);
        }
        return new notification_dto_1.NotificationResponseDto(notification);
    }
    async markMultipleAsRead(notificationIds) {
        const invalidIds = notificationIds.filter((id) => !mongoose_2.Types.ObjectId.isValid(id));
        if (invalidIds.length > 0) {
            throw new common_1.BadRequestException(`Invalid notification IDs: ${invalidIds.join(', ')}`);
        }
        const result = await this.notificationModel
            .updateMany({ _id: { $in: notificationIds } }, { read: true })
            .exec();
        return new notification_dto_1.BulkOperationResponseDto({
            success: true,
            message: `Successfully marked ${result.modifiedCount} notifications as read`,
            affectedIds: notificationIds,
            count: result.modifiedCount,
        });
    }
    async deleteMultipleNotifications(notificationIds) {
        const invalidIds = notificationIds.filter((id) => !mongoose_2.Types.ObjectId.isValid(id));
        if (invalidIds.length > 0) {
            throw new common_1.BadRequestException(`Invalid notification IDs: ${invalidIds.join(', ')}`);
        }
        const result = await this.notificationModel
            .deleteMany({ _id: { $in: notificationIds } })
            .exec();
        return new notification_dto_1.BulkOperationResponseDto({
            success: true,
            message: `Successfully deleted ${result.deletedCount} notifications`,
            affectedIds: notificationIds,
            count: result.deletedCount,
        });
    }
    async getUnreadCount() {
        const count = await this.notificationModel.countDocuments({ read: false });
        return { count };
    }
    async getNotificationsByRepository(repository) {
        const notifications = await this.notificationModel
            .find({ repository })
            .sort({ createdAt: -1 })
            .lean()
            .exec();
        return notifications.map((n) => new notification_dto_1.NotificationResponseDto(n));
    }
    async searchNotifications(searchTerm, options) {
        const { limit = 20, offset = 0, ...filters } = options ?? {};
        const query = {
            ...filters,
            $or: [
                { title: { $regex: searchTerm, $options: 'i' } },
                { description: { $regex: searchTerm, $options: 'i' } },
                { repository: { $regex: searchTerm, $options: 'i' } },
            ],
        };
        const notifications = await this.notificationModel
            .find(query)
            .sort({ createdAt: -1 })
            .skip(Math.max(offset, 0))
            .limit(Math.min(Math.max(limit, 1), 100))
            .lean()
            .exec();
        return notifications.map((n) => new notification_dto_1.NotificationResponseDto(n));
    }
    async cleanupOldNotifications(daysOld = 30) {
        const cutoffDate = new Date();
        cutoffDate.setDate(cutoffDate.getDate() - daysOld);
        const result = await this.notificationModel
            .deleteMany({
            createdAt: { $lt: cutoffDate },
            read: true,
        })
            .exec();
        this.logger.log(`Cleaned up ${result.deletedCount} notifications older than ${daysOld} days`);
        return { deletedCount: result.deletedCount };
    }
    async sendNotificationsBasedOnPreferences(userId, notifications) {
        try {
            const preferences = await this.userPreferencesService.getUserPreferences(userId);
            for (const notification of notifications) {
                if (preferences.notificationPreferences.inAppNotifications) {
                    this.logger.log(`In-app notification created for user ${userId}`);
                }
                if (preferences.notificationPreferences.emailNotifications) {
                    await this.sendEmailNotification(userId, notification);
                }
                if (notification.type === 'SECURITY_VULNERABILITY') {
                    const securityThreshold = preferences.notificationPreferences.securityAlertThreshold;
                    const alertCount = notification.metadata
                        ?.alertCount ?? 0;
                    if (alertCount > securityThreshold) {
                        this.logger.log(`High priority security alert for user ${userId}: ${alertCount} vulnerabilities`);
                    }
                }
            }
        }
        catch (error) {
            this.logger.error('Error sending notifications based on preferences:', error);
        }
    }
    async sendEmailNotification(userId, notification) {
        await Promise.resolve();
        this.logger.log(`Would send email to user ${userId} for notification: ${notification.title}`);
    }
};
exports.NotificationService = NotificationService;
exports.NotificationService = NotificationService = NotificationService_1 = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, mongoose_1.InjectModel)('Notification')),
    __param(3, (0, common_1.Inject)(cache_manager_1.CACHE_MANAGER)),
    __metadata("design:paramtypes", [mongoose_2.Model,
        repo_health_service_1.RepoHealthService,
        preferences_service_1.UserPreferencesService, Object])
], NotificationService);
//# sourceMappingURL=notification.service.js.map