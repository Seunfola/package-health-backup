"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.AppModule = void 0;
const common_1 = require("@nestjs/common");
const cache_manager_1 = require("@nestjs/cache-manager");
const config_1 = require("@nestjs/config");
const app_controller_1 = require("./app.controller");
const app_service_1 = require("./app.service");
const repo_health_module_1 = require("./repo-health/repo-health.module");
const user_profile_module_1 = require("./user-profile/user-profile.module");
const repository_details_module_1 = require("./repository-details/repository-details.module");
const auth_module_1 = require("./auth/auth.module");
const database_module_1 = require("./config/database.module");
const notification_module_1 = require("./notification/notification.module");
const preferences_module_1 = require("./preference/preferences.module");
let AppModule = class AppModule {
};
exports.AppModule = AppModule;
exports.AppModule = AppModule = __decorate([
    (0, common_1.Module)({
        imports: [
            config_1.ConfigModule.forRoot({
                isGlobal: true,
                envFilePath: '.env',
            }),
            cache_manager_1.CacheModule.register({
                ttl: 60 * 5,
                max: 100,
                isGlobal: true,
            }),
            database_module_1.DatabaseModule,
            repo_health_module_1.RepoHealthModule,
            auth_module_1.AuthModule,
            user_profile_module_1.UserProfileModule,
            repository_details_module_1.RepositoryDetailsModule,
            notification_module_1.NotificationModule,
            preferences_module_1.UserPreferencesModule,
        ],
        controllers: [app_controller_1.AppController],
        providers: [app_service_1.AppService],
    })
], AppModule);
//# sourceMappingURL=app.module.js.map