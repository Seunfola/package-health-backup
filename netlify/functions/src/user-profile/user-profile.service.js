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
exports.UserProfileService = void 0;
const common_1 = require("@nestjs/common");
const mongoose_1 = require("@nestjs/mongoose");
const mongoose_2 = require("mongoose");
const rxjs_1 = require("rxjs");
const axios_1 = require("@nestjs/axios");
const user_profile_model_1 = require("./user-profile.model");
let UserProfileService = class UserProfileService {
    userProfileModel;
    httpService;
    constructor(userProfileModel, httpService) {
        this.userProfileModel = userProfileModel;
        this.httpService = httpService;
    }
    async create(data) {
        const newUser = new this.userProfileModel(data);
        return await newUser.save();
    }
    async findByUsername(username) {
        return this.userProfileModel.findOne({ username }).exec();
    }
    async findAll() {
        return this.userProfileModel.find().exec();
    }
    async updateProfile(userId, profileData) {
        try {
            const updatedProfile = await this.userProfileModel
                .findByIdAndUpdate(userId, profileData, {
                new: true,
                upsert: true,
            })
                .exec();
            if (!updatedProfile) {
                throw new Error('User profile not found or failed to update');
            }
            return updatedProfile;
        }
        catch (error) {
            this.handleError('Updating user profile', error);
        }
    }
    parseResume() {
        console.log('Parsing resume...');
        return {
            name: 'John Doe',
            email: 'john.doe@example.com',
            linkedin_url: 'https://linkedin.com/in/johndoe',
        };
    }
    async getSocialProfileData(platform, username) {
        try {
            switch (platform.toLowerCase()) {
                case 'github':
                    return this.getGitHubProfile(username);
                case 'linkedin':
                    return { linkedin_url: `https://linkedin.com/in/${username}` };
                default:
                    throw new Error(`Unsupported social media platform: ${platform}`);
            }
        }
        catch (error) {
            this.handleError(`Fetching ${platform} profile`, error);
        }
    }
    async getGitHubProfile(username) {
        const GITHUB_API_URL = `https://api.github.com/users/${username}`;
        try {
            const response = await (0, rxjs_1.lastValueFrom)(this.httpService.get(GITHUB_API_URL));
            const data = response?.data;
            if (!data || typeof data !== 'object') {
                throw new Error('Invalid response structure from GitHub API');
            }
            const { avatar_url = '', html_url = '', name = '', bio = '' } = data;
            return {
                profile_picture_url: avatar_url,
                github_url: html_url,
                name,
                bio,
            };
        }
        catch (error) {
            this.handleError('Fetching GitHub profile', error);
        }
    }
    handleError(context, error) {
        if (error instanceof Error) {
            console.error(`${context} failed:`, error.message);
            throw new Error(`${context} failed: ${error.message}`);
        }
        console.error(`${context} failed with unknown error:`, error);
        throw new Error(`${context} failed with unknown error`);
    }
};
exports.UserProfileService = UserProfileService;
exports.UserProfileService = UserProfileService = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, mongoose_1.InjectModel)(user_profile_model_1.UserProfile.name)),
    __metadata("design:paramtypes", [mongoose_2.Model,
        axios_1.HttpService])
], UserProfileService);
//# sourceMappingURL=user-profile.service.js.map