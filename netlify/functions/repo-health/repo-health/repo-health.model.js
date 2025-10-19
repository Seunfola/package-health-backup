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
exports.RepoHealthSchema = exports.RepoHealth = exports.OverallHealthSchema = exports.OverallHealth = void 0;
const mongoose_1 = require("@nestjs/mongoose");
const mongoose_2 = require("mongoose");
let OverallHealth = class OverallHealth {
    score;
    label;
};
exports.OverallHealth = OverallHealth;
__decorate([
    (0, mongoose_1.Prop)({ type: Number, required: true }),
    __metadata("design:type", Number)
], OverallHealth.prototype, "score", void 0);
__decorate([
    (0, mongoose_1.Prop)({ type: String, required: true }),
    __metadata("design:type", String)
], OverallHealth.prototype, "label", void 0);
exports.OverallHealth = OverallHealth = __decorate([
    (0, mongoose_1.Schema)({ _id: false })
], OverallHealth);
exports.OverallHealthSchema = mongoose_1.SchemaFactory.createForClass(OverallHealth);
let RepoHealth = class RepoHealth extends mongoose_2.Document {
    repo_id;
    owner;
    repo;
    name;
    stars;
    forks;
    open_issues;
    last_pushed;
    overall_health;
    commit_activity;
    security_alerts;
    dependency_health;
    risky_dependencies;
    createdAt;
};
exports.RepoHealth = RepoHealth;
__decorate([
    (0, mongoose_1.Prop)({ required: true, unique: true }),
    __metadata("design:type", String)
], RepoHealth.prototype, "repo_id", void 0);
__decorate([
    (0, mongoose_1.Prop)({ required: true }),
    __metadata("design:type", String)
], RepoHealth.prototype, "owner", void 0);
__decorate([
    (0, mongoose_1.Prop)({ required: true }),
    __metadata("design:type", String)
], RepoHealth.prototype, "repo", void 0);
__decorate([
    (0, mongoose_1.Prop)(),
    __metadata("design:type", String)
], RepoHealth.prototype, "name", void 0);
__decorate([
    (0, mongoose_1.Prop)(),
    __metadata("design:type", Number)
], RepoHealth.prototype, "stars", void 0);
__decorate([
    (0, mongoose_1.Prop)(),
    __metadata("design:type", Number)
], RepoHealth.prototype, "forks", void 0);
__decorate([
    (0, mongoose_1.Prop)(),
    __metadata("design:type", Number)
], RepoHealth.prototype, "open_issues", void 0);
__decorate([
    (0, mongoose_1.Prop)(),
    __metadata("design:type", Date)
], RepoHealth.prototype, "last_pushed", void 0);
__decorate([
    (0, mongoose_1.Prop)({ type: exports.OverallHealthSchema }),
    __metadata("design:type", OverallHealth)
], RepoHealth.prototype, "overall_health", void 0);
__decorate([
    (0, mongoose_1.Prop)(),
    __metadata("design:type", Array)
], RepoHealth.prototype, "commit_activity", void 0);
__decorate([
    (0, mongoose_1.Prop)(),
    __metadata("design:type", Number)
], RepoHealth.prototype, "security_alerts", void 0);
__decorate([
    (0, mongoose_1.Prop)(),
    __metadata("design:type", Number)
], RepoHealth.prototype, "dependency_health", void 0);
__decorate([
    (0, mongoose_1.Prop)(),
    __metadata("design:type", Array)
], RepoHealth.prototype, "risky_dependencies", void 0);
__decorate([
    (0, mongoose_1.Prop)({ expires: 604800 }),
    __metadata("design:type", Date)
], RepoHealth.prototype, "createdAt", void 0);
exports.RepoHealth = RepoHealth = __decorate([
    (0, mongoose_1.Schema)({ timestamps: true })
], RepoHealth);
exports.RepoHealthSchema = mongoose_1.SchemaFactory.createForClass(RepoHealth);
//# sourceMappingURL=repo-health.model.js.map