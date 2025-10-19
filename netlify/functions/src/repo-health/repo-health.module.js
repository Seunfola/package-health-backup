"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.RepoHealthModule = void 0;
const common_1 = require("@nestjs/common");
const axios_1 = require("@nestjs/axios");
const mongoose_1 = require("@nestjs/mongoose");
const repo_health_model_1 = require("./repo-health/repo-health.model");
const repo_health_controller_1 = require("./repo-health/repo-health.controller");
const repo_health_service_1 = require("./repo-health/repo-health.service");
const dependency_analyzer_service_1 = require("./repo-health/dependency-analyzer.service");
let RepoHealthModule = class RepoHealthModule {
};
exports.RepoHealthModule = RepoHealthModule;
exports.RepoHealthModule = RepoHealthModule = __decorate([
    (0, common_1.Module)({
        imports: [
            axios_1.HttpModule,
            mongoose_1.MongooseModule.forFeature([
                { name: repo_health_model_1.RepoHealth.name, schema: repo_health_model_1.RepoHealthSchema },
            ]),
        ],
        controllers: [repo_health_controller_1.RepoHealthController],
        providers: [repo_health_service_1.RepoHealthService, dependency_analyzer_service_1.DependencyAnalyzerService],
        exports: [repo_health_service_1.RepoHealthService],
    })
], RepoHealthModule);
//# sourceMappingURL=repo-health.module.js.map