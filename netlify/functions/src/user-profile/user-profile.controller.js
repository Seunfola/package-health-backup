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
exports.UserProfileController = void 0;
const common_1 = require("@nestjs/common");
const platform_express_1 = require("@nestjs/platform-express");
const swagger_1 = require("@nestjs/swagger");
const user_profile_service_1 = require("./user-profile.service");
let UserProfileController = class UserProfileController {
    userProfileService;
    constructor(userProfileService) {
        this.userProfileService = userProfileService;
    }
    async uploadResume(file, userId) {
        if (!file) {
            return { message: 'No file uploaded.' };
        }
        const parsedData = this.userProfileService.parseResume();
        const updatedProfile = await this.userProfileService.updateProfile(userId, parsedData);
        return {
            message: 'Profile updated successfully!',
            data: updatedProfile,
        };
    }
    async getAll() {
        return this.userProfileService.findAll();
    }
    async getOne(username) {
        const user = await this.userProfileService.findByUsername(username);
        if (!user) {
            throw new common_1.NotFoundException(`User with username '${username}' not found.`);
        }
        return user;
    }
    async create(body) {
        const newUser = await this.userProfileService.create(body);
        return {
            message: 'User profile created successfully!',
            data: newUser,
        };
    }
    async linkSocialProfile(body) {
        try {
            const { userId, platform, username } = body;
            const socialData = await this.userProfileService.getSocialProfileData(platform, username);
            const updatedProfile = await this.userProfileService.updateProfile(userId, socialData);
            return {
                message: 'Social profile linked successfully!',
                data: updatedProfile,
            };
        }
        catch (error) {
            return {
                message: 'Failed to link social profile.',
                error: error instanceof Error ? error.message : String(error),
            };
        }
    }
};
exports.UserProfileController = UserProfileController;
__decorate([
    (0, common_1.Post)('upload-resume/:userId'),
    (0, common_1.UseInterceptors)((0, platform_express_1.FileInterceptor)('resume')),
    (0, swagger_1.ApiOperation)({ summary: 'Upload a resume to update user profile' }),
    (0, swagger_1.ApiConsumes)('multipart/form-data'),
    (0, swagger_1.ApiBody)({
        schema: {
            type: 'object',
            properties: {
                resume: {
                    type: 'string',
                    format: 'binary',
                },
            },
        },
    }),
    __param(0, (0, common_1.UploadedFile)()),
    __param(1, (0, common_1.Param)('userId')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", Promise)
], UserProfileController.prototype, "uploadResume", null);
__decorate([
    (0, common_1.Get)(),
    (0, swagger_1.ApiOperation)({ summary: 'Get all user profiles' }),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", Promise)
], UserProfileController.prototype, "getAll", null);
__decorate([
    (0, common_1.Get)(':username'),
    (0, swagger_1.ApiOperation)({ summary: 'Get a single user profile by username' }),
    __param(0, (0, common_1.Param)('username')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", Promise)
], UserProfileController.prototype, "getOne", null);
__decorate([
    (0, common_1.Post)(),
    (0, swagger_1.ApiOperation)({ summary: 'Create a new user profile' }),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], UserProfileController.prototype, "create", null);
__decorate([
    (0, common_1.Post)('link-social'),
    (0, swagger_1.ApiOperation)({ summary: 'Link a social profile (e.g., GitHub, LinkedIn)' }),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], UserProfileController.prototype, "linkSocialProfile", null);
exports.UserProfileController = UserProfileController = __decorate([
    (0, swagger_1.ApiTags)('profile'),
    (0, common_1.Controller)('profile'),
    __metadata("design:paramtypes", [user_profile_service_1.UserProfileService])
], UserProfileController);
//# sourceMappingURL=user-profile.controller.js.map