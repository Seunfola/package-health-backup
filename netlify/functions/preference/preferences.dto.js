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
exports.PreferencesResponseDto = exports.UpdatePreferencesDto = exports.NotificationPreferencesDto = exports.DashboardMetricsDto = void 0;
const class_validator_1 = require("class-validator");
class DashboardMetricsDto {
    codeQualityScore;
    testCoverage;
    dependencyVulnerabilities;
    securityAlerts;
}
exports.DashboardMetricsDto = DashboardMetricsDto;
__decorate([
    (0, class_validator_1.IsBoolean)(),
    __metadata("design:type", Boolean)
], DashboardMetricsDto.prototype, "codeQualityScore", void 0);
__decorate([
    (0, class_validator_1.IsBoolean)(),
    __metadata("design:type", Boolean)
], DashboardMetricsDto.prototype, "testCoverage", void 0);
__decorate([
    (0, class_validator_1.IsBoolean)(),
    __metadata("design:type", Boolean)
], DashboardMetricsDto.prototype, "dependencyVulnerabilities", void 0);
__decorate([
    (0, class_validator_1.IsBoolean)(),
    __metadata("design:type", Boolean)
], DashboardMetricsDto.prototype, "securityAlerts", void 0);
class NotificationPreferencesDto {
    emailNotifications;
    inAppNotifications;
    securityAlertThreshold;
    dependencyUpdateFrequency;
}
exports.NotificationPreferencesDto = NotificationPreferencesDto;
__decorate([
    (0, class_validator_1.IsBoolean)(),
    __metadata("design:type", Boolean)
], NotificationPreferencesDto.prototype, "emailNotifications", void 0);
__decorate([
    (0, class_validator_1.IsBoolean)(),
    __metadata("design:type", Boolean)
], NotificationPreferencesDto.prototype, "inAppNotifications", void 0);
__decorate([
    (0, class_validator_1.IsNumber)(),
    (0, class_validator_1.Min)(0),
    (0, class_validator_1.Max)(100),
    __metadata("design:type", Number)
], NotificationPreferencesDto.prototype, "securityAlertThreshold", void 0);
__decorate([
    (0, class_validator_1.IsIn)(['realtime', 'daily', 'weekly']),
    __metadata("design:type", String)
], NotificationPreferencesDto.prototype, "dependencyUpdateFrequency", void 0);
class UpdatePreferencesDto {
    dashboardMetrics;
    notificationPreferences;
}
exports.UpdatePreferencesDto = UpdatePreferencesDto;
class PreferencesResponseDto {
    userId;
    dashboardMetrics;
    notificationPreferences;
    createdAt;
    updatedAt;
    constructor(preferences) {
        this.userId = preferences.userId;
        this.dashboardMetrics = preferences.dashboardMetrics;
        this.notificationPreferences = preferences.notificationPreferences;
        this.createdAt = preferences.createdAt;
        this.updatedAt = preferences.updatedAt;
    }
}
exports.PreferencesResponseDto = PreferencesResponseDto;
//# sourceMappingURL=preferences.dto.js.map