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
exports.UserPreferencesController = void 0;
const common_1 = require("@nestjs/common");
const jwt_auth_guard_1 = require("../auth/jwt-auth.guard");
const preferences_service_1 = require("./preferences.service");
const preferences_dto_1 = require("./preferences.dto");
let UserPreferencesController = class UserPreferencesController {
    preferencesService;
    constructor(preferencesService) {
        this.preferencesService = preferencesService;
    }
    getDefaultPreferences() {
        try {
            const defaults = this.preferencesService.getDefaultPreferences();
            return new preferences_dto_1.PreferencesResponseDto(defaults);
        }
        catch (error) {
            if (error instanceof Error) {
                throw new common_1.HttpException(error.message, common_1.HttpStatus.INTERNAL_SERVER_ERROR);
            }
            throw new common_1.HttpException('Failed to fetch default preferences', common_1.HttpStatus.INTERNAL_SERVER_ERROR);
        }
    }
    async resetPreferences(req) {
        try {
            const userId = req.user.id;
            const preferences = await this.preferencesService.resetToDefaults(userId);
            return new preferences_dto_1.PreferencesResponseDto(preferences);
        }
        catch (error) {
            const message = error instanceof Error ? error.message : 'Failed to reset preferences';
            throw new common_1.HttpException(message, common_1.HttpStatus.INTERNAL_SERVER_ERROR);
        }
    }
    async getPreferences(req) {
        try {
            const userId = req.user.id;
            const preferences = await this.preferencesService.getUserPreferences(userId);
            return new preferences_dto_1.PreferencesResponseDto(preferences);
        }
        catch (error) {
            const message = error instanceof Error ? error.message : 'Failed to fetch preferences';
            throw new common_1.HttpException(message, common_1.HttpStatus.INTERNAL_SERVER_ERROR);
        }
    }
    async updatePreferences(req, updatePreferencesDto) {
        try {
            const userId = req.user.id;
            const preferences = await this.preferencesService.updateUserPreferences(userId, updatePreferencesDto);
            return new preferences_dto_1.PreferencesResponseDto(preferences);
        }
        catch (error) {
            const message = error instanceof Error ? error.message : 'Failed to update preferences';
            throw new common_1.HttpException(message, common_1.HttpStatus.BAD_REQUEST);
        }
    }
};
exports.UserPreferencesController = UserPreferencesController;
__decorate([
    (0, common_1.Get)('defaults'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", preferences_dto_1.PreferencesResponseDto)
], UserPreferencesController.prototype, "getDefaultPreferences", null);
__decorate([
    (0, common_1.Post)('reset'),
    __param(0, (0, common_1.Request)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], UserPreferencesController.prototype, "resetPreferences", null);
__decorate([
    (0, common_1.Get)(),
    __param(0, (0, common_1.Request)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], UserPreferencesController.prototype, "getPreferences", null);
__decorate([
    (0, common_1.Put)(),
    __param(0, (0, common_1.Request)()),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, preferences_dto_1.UpdatePreferencesDto]),
    __metadata("design:returntype", Promise)
], UserPreferencesController.prototype, "updatePreferences", null);
exports.UserPreferencesController = UserPreferencesController = __decorate([
    (0, common_1.Controller)('user/preferences'),
    (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard),
    __metadata("design:paramtypes", [preferences_service_1.UserPreferencesService])
], UserPreferencesController);
//# sourceMappingURL=preferences.controller.js.map