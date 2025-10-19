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
exports.RepoHealthController = void 0;
const common_1 = require("@nestjs/common");
const platform_express_1 = require("@nestjs/platform-express");
const swagger_1 = require("@nestjs/swagger");
const repo_health_service_1 = require("./repo-health.service");
let RepoHealthController = class RepoHealthController {
    repoHealthService;
    constructor(repoHealthService) {
        this.repoHealthService = repoHealthService;
    }
    async analyzeByUrl(body) {
        const { url, token } = body;
        if (!url) {
            throw new common_1.HttpException('GitHub URL is required', common_1.HttpStatus.BAD_REQUEST);
        }
        try {
            return await this.repoHealthService.analyzeByUrl(url, undefined, undefined, token);
        }
        catch (err) {
            const message = err instanceof Error ? err.message : 'Unexpected error occurred';
            throw new common_1.HttpException(message, common_1.HttpStatus.BAD_REQUEST);
        }
    }
    async analyzeUploadedPackage(file) {
        if (!file) {
            throw new common_1.HttpException('No file uploaded', common_1.HttpStatus.BAD_REQUEST);
        }
        try {
            const deps = this.repoHealthService['_getDependenciesFromFile'](file);
            const analysis = await this.repoHealthService.analyzeJson(JSON.stringify({ dependencies: deps }));
            return {
                project_name: file.originalname,
                dependencies: deps,
                dependency_health: analysis.dependency_health,
                risky_dependencies: analysis.risky_dependencies,
                outdated_dependencies: analysis.outdated_dependencies,
            };
        }
        catch (err) {
            const message = err instanceof Error ? err.message : String(err);
            throw new common_1.HttpException(message, common_1.HttpStatus.BAD_REQUEST);
        }
    }
    async analyzePastedPackage(json) {
        if (!json) {
            throw new common_1.HttpException('No JSON provided', common_1.HttpStatus.BAD_REQUEST);
        }
        try {
            return await this.repoHealthService.analyzeJson(json);
        }
        catch (err) {
            const message = err instanceof Error ? err.message : String(err);
            throw new common_1.HttpException(message, common_1.HttpStatus.BAD_REQUEST);
        }
    }
    async fetchStoredRepo(body) {
        const { owner, repo } = body;
        if (!owner || !repo) {
            throw new common_1.HttpException('Both owner and repo are required', common_1.HttpStatus.BAD_REQUEST);
        }
        try {
            return await this.repoHealthService.findRepoHealth(owner, repo);
        }
        catch (err) {
            const message = err instanceof Error ? err.message : 'Unexpected error occurred';
            throw new common_1.HttpException(message, common_1.HttpStatus.BAD_REQUEST);
        }
    }
};
exports.RepoHealthController = RepoHealthController;
__decorate([
    (0, common_1.Post)('analyze-url'),
    (0, swagger_1.ApiOperation)({ summary: 'Analyze a repository by GitHub URL' }),
    (0, swagger_1.ApiBody)({
        schema: {
            type: 'object',
            properties: {
                url: { type: 'string', example: 'https://github.com/nestjs/nest' },
                token: { type: 'string', example: 'ghp_xxx' },
            },
            required: ['url'],
        },
    }),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], RepoHealthController.prototype, "analyzeByUrl", null);
__decorate([
    (0, common_1.Post)('analyze-package/upload'),
    (0, common_1.UseInterceptors)((0, platform_express_1.FileInterceptor)('file')),
    (0, swagger_1.ApiOperation)({
        summary: 'Analyze uploaded package.json, package-lock.json, or folder zip',
    }),
    (0, swagger_1.ApiConsumes)('multipart/form-data'),
    (0, swagger_1.ApiBody)({
        schema: {
            type: 'object',
            properties: { file: { type: 'string', format: 'binary' } },
            required: ['file'],
        },
    }),
    __param(0, (0, common_1.UploadedFile)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], RepoHealthController.prototype, "analyzeUploadedPackage", null);
__decorate([
    (0, common_1.Post)('analyze-package/paste'),
    (0, swagger_1.ApiOperation)({ summary: 'Analyze pasted package.json content' }),
    (0, swagger_1.ApiBody)({
        schema: {
            type: 'object',
            properties: {
                json: { type: 'string', description: 'Raw package.json content' },
            },
            required: ['json'],
        },
    }),
    __param(0, (0, common_1.Body)('json')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", Promise)
], RepoHealthController.prototype, "analyzePastedPackage", null);
__decorate([
    (0, common_1.Post)('fetch'),
    (0, swagger_1.ApiOperation)({ summary: 'Fetch stored repository health info' }),
    (0, swagger_1.ApiBody)({
        schema: {
            type: 'object',
            properties: { owner: { type: 'string' }, repo: { type: 'string' } },
            required: ['owner', 'repo'],
        },
    }),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], RepoHealthController.prototype, "fetchStoredRepo", null);
exports.RepoHealthController = RepoHealthController = __decorate([
    (0, swagger_1.ApiTags)('repo-health'),
    (0, common_1.Controller)('repo-health'),
    __metadata("design:paramtypes", [repo_health_service_1.RepoHealthService])
], RepoHealthController);
//# sourceMappingURL=repo-health.controller.js.map