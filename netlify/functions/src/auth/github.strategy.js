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
exports.GitHubStrategy = void 0;
const common_1 = require("@nestjs/common");
const passport_1 = require("@nestjs/passport");
const passport_github2_1 = require("passport-github2");
let GitHubStrategy = class GitHubStrategy extends (0, passport_1.PassportStrategy)(passport_github2_1.Strategy, 'github') {
    constructor() {
        const clientID = process.env.GITHUB_CLIENT_ID;
        const clientSecret = process.env.GITHUB_CLIENT_SECRET;
        const callbackURL = process.env.GITHUB_CALLBACK_URL;
        if (!clientID || !clientSecret || !callbackURL) {
            throw new Error('GitHub OAuth environment variables (CLIENT_ID, CLIENT_SECRET, CALLBACK_URL) must be set');
        }
        super({
            clientID,
            clientSecret,
            callbackURL,
            scope: ['repo', 'read:user'],
        });
    }
    validate(accessToken, refreshToken, profile) {
        const githubId = typeof profile?.id === 'string' || typeof profile?.id === 'number'
            ? String(profile.id)
            : '';
        const username = typeof profile?.username === 'string'
            ? profile.username
            : typeof profile?.displayName === 'string'
                ? profile.displayName
                : 'unknown';
        return { githubId, username, accessToken };
    }
};
exports.GitHubStrategy = GitHubStrategy;
exports.GitHubStrategy = GitHubStrategy = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [])
], GitHubStrategy);
//# sourceMappingURL=github.strategy.js.map