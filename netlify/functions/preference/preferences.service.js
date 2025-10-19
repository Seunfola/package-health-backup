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
exports.UserPreferencesService = void 0;
const common_1 = require("@nestjs/common");
const mongoose_1 = require("@nestjs/mongoose");
const mongoose_2 = require("mongoose");
let UserPreferencesService = class UserPreferencesService {
    preferencesModel;
    constructor(preferencesModel) {
        this.preferencesModel = preferencesModel;
    }
    async getUserPreferences(userId) {
        let preferences = await this.preferencesModel.findOne({ userId });
        if (!preferences) {
            preferences = await this.preferencesModel.create({ userId });
        }
        return preferences;
    }
    async updateUserPreferences(userId, updatePreferencesDto) {
        const preferences = await this.preferencesModel.findOneAndUpdate({ userId }, {
            $set: {
                dashboardMetrics: updatePreferencesDto.dashboardMetrics,
                notificationPreferences: updatePreferencesDto.notificationPreferences,
            },
        }, { new: true, upsert: true, runValidators: true });
        return preferences;
    }
    async shouldSendNotification(userId, notificationType) {
        const preferences = await this.getUserPreferences(userId);
        switch (notificationType) {
            case 'email':
                return preferences.notificationPreferences.emailNotifications;
            case 'inApp':
                return preferences.notificationPreferences.inAppNotifications;
            default:
                return true;
        }
    }
    getDefaults() {
        return {
            dashboardMetrics: {
                codeQualityScore: true,
                testCoverage: true,
                dependencyVulnerabilities: true,
                securityAlerts: true,
            },
            notificationPreferences: {
                emailNotifications: true,
                inAppNotifications: true,
                securityAlertThreshold: 70,
                dependencyUpdateFrequency: 'daily',
            },
        };
    }
    getDefaultPreferences() {
        return {
            userId: '',
            ...this.getDefaults(),
            createdAt: new Date(),
            updatedAt: new Date(),
        };
    }
    async resetToDefaults(userId) {
        const defaultPreferences = new this.preferencesModel().toObject();
        return this.preferencesModel.findOneAndUpdate({ userId }, {
            $set: {
                dashboardMetrics: defaultPreferences
                    .dashboardMetrics,
                notificationPreferences: defaultPreferences
                    .notificationPreferences,
            },
        }, { new: true, upsert: true, runValidators: true });
    }
    async getSecurityAlertThreshold(userId) {
        const preferences = await this.getUserPreferences(userId);
        return preferences.notificationPreferences.securityAlertThreshold;
    }
};
exports.UserPreferencesService = UserPreferencesService;
exports.UserPreferencesService = UserPreferencesService = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, mongoose_1.InjectModel)('UserPreferences')),
    __metadata("design:paramtypes", [mongoose_2.Model])
], UserPreferencesService);
//# sourceMappingURL=preferences.service.js.map