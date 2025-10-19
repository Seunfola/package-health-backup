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
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.RepoHealthService = void 0;
const common_1 = require("@nestjs/common");
const mongoose_1 = require("@nestjs/mongoose");
const mongoose_2 = require("mongoose");
const axios_1 = require("@nestjs/axios");
const rxjs_1 = require("rxjs");
const dependency_analyzer_service_1 = require("./dependency-analyzer.service");
const repo_health_model_1 = require("./repo-health.model");
const adm_zip_1 = __importDefault(require("adm-zip"));
const path_1 = __importDefault(require("path"));
const fs_1 = __importDefault(require("fs"));
class Semaphore {
    max;
    queue = [];
    counter = 0;
    constructor(max) {
        this.max = max;
    }
    async acquire() {
        if (this.counter < this.max) {
            this.counter++;
            return () => {
                this.counter--;
                const next = this.queue.shift();
                if (next)
                    next();
            };
        }
        return new Promise((resolve) => {
            this.queue.push(() => {
                this.counter++;
                resolve(() => {
                    this.counter--;
                    const next = this.queue.shift();
                    if (next)
                        next();
                });
            });
        });
    }
}
let RepoHealthService = class RepoHealthService {
    repoHealthModel;
    httpService;
    dependencyAnalyzer;
    analysisSemaphore = new Semaphore(4);
    cache = new Map();
    dockerAvailable;
    constructor(repoHealthModel, httpService, dependencyAnalyzer) {
        this.repoHealthModel = repoHealthModel;
        this.httpService = httpService;
        this.dependencyAnalyzer = dependencyAnalyzer;
        this.dockerAvailable = this.detectDocker();
    }
    detectDocker() {
        try {
            return fs_1.default.existsSync('/var/run/docker.sock');
        }
        catch {
            return false;
        }
    }
    async findOne(owner, repo) {
        try {
            const record = await this.repoHealthModel.findOne({ owner, repo }).exec();
            return record;
        }
        catch {
            throw new common_1.HttpException('Failed to find repository', common_1.HttpStatus.INTERNAL_SERVER_ERROR);
        }
    }
    async findMany(query) {
        try {
            const { owner, repo, minHealthScore, limit = 50, offset = 0 } = query;
            const mongoQuery = {};
            if (owner) {
                mongoQuery['owner'] = owner;
            }
            if (repo) {
                mongoQuery['repo'] = repo;
            }
            if (minHealthScore !== undefined) {
                mongoQuery['overall_health.score'] = { $gte: minHealthScore };
            }
            const records = await this.repoHealthModel
                .find(mongoQuery)
                .skip(offset)
                .limit(limit)
                .exec();
            return records;
        }
        catch {
            throw new common_1.HttpException('Failed to find repositories', common_1.HttpStatus.INTERNAL_SERVER_ERROR);
        }
    }
    async findAll() {
        try {
            return await this.repoHealthModel.find().exec();
        }
        catch {
            throw new common_1.HttpException('Failed to retrieve all repositories', common_1.HttpStatus.INTERNAL_SERVER_ERROR);
        }
    }
    async getAllRepoStatuses() {
        try {
            const repos = await this.repoHealthModel.find().lean().exec();
            return repos.map((repo) => ({
                ...repo,
                vulnerabilities: Array.from({ length: repo.security_alerts || 0 }, (_, i) => ({
                    packageName: `vulnerability-${i}`,
                    severity: 'high',
                    detectedAt: new Date(),
                })),
                outdatedDependencies: (repo.risky_dependencies || []).map((name) => ({
                    name,
                    latest: 'unknown',
                    updatedAt: new Date(),
                })),
            }));
        }
        catch {
            return [];
        }
    }
    async findRepoHealth(owner, repo) {
        const record = await this.repoHealthModel.findOne({ owner, repo }).exec();
        if (!record) {
            throw new common_1.HttpException(`No analysis found for ${owner}/${repo}`, common_1.HttpStatus.NOT_FOUND);
        }
        return record.toObject();
    }
    async analyzeRepo(owner, repo, file, rawJson, token) {
        const repoKey = `repo:${owner}/${repo}`;
        const repoData = await this.requestWithCache(repoKey, () => this.fetchRepo(owner, repo, token), 1000 * 60 * 5);
        const commitActivity = await this.requestWithCache(`commits:${owner}/${repo}`, () => this.fetchCommitActivity(owner, repo, token), 1000 * 60 * 3);
        const securityAlerts = await this.requestWithCache(`alerts:${owner}/${repo}`, () => this.fetchSecurityAlerts(owner, repo, token), 1000 * 60 * 3);
        const { dependencyHealth, riskyDependencies } = await this._processDependencies(file, rawJson, this.dockerAvailable);
        const overallHealth = this._calculateHealthScore(repoData, commitActivity, securityAlerts, dependencyHealth);
        const repo_id = `${owner}/${repo}`;
        const updated = await this.repoHealthModel.findOneAndUpdate({ repo_id }, {
            repo_id,
            owner,
            repo,
            name: repoData.name,
            stars: repoData.stargazers_count,
            forks: repoData.forks_count,
            open_issues: repoData.open_issues_count,
            last_pushed: new Date(repoData.pushed_at),
            commit_activity: Array.isArray(commitActivity)
                ? commitActivity.map((c) => typeof c.total === 'number' ? c.total : 0)
                : [],
            security_alerts: Array.isArray(securityAlerts)
                ? securityAlerts.length
                : 0,
            dependency_health: dependencyHealth,
            risky_dependencies: riskyDependencies,
            overall_health: overallHealth,
        }, { new: true, upsert: true, setDefaultsOnInsert: true });
        return updated.toObject();
    }
    async processDependencies(file, rawJson) {
        return this._processDependencies(file, rawJson, this.dockerAvailable);
    }
    async getCommitActivity(owner, repo, token) {
        return this.fetchCommitActivity(owner, repo, token);
    }
    async getSecurityAlerts(owner, repo, token) {
        return this.fetchSecurityAlerts(owner, repo, token);
    }
    calculateHealthScore(data, commitActivity, securityAlerts, dependencyHealth) {
        return this._calculateHealthScore(data, commitActivity, securityAlerts, dependencyHealth);
    }
    async analyzeByUrl(url, file, rawJson, token) {
        const { owner, repo } = this.parseGitHubUrl(url);
        return this.analyzeRepo(owner, repo, file, rawJson, token);
    }
    async analyzeJson(rawJson) {
        const parsed = this._parseJson(rawJson);
        const deps = this._extractDependencies(parsed) ?? {};
        const analysis = await this.dependencyAnalyzer.analyzeDependencies(deps);
        let projectName = 'unknown';
        if ('name' in parsed && typeof parsed.name === 'string') {
            projectName = parsed.name;
        }
        const totalDependencies = Object.keys(deps).length;
        return {
            project_name: projectName,
            total_dependencies: totalDependencies,
            dependencies: deps,
            dependency_health: {
                score: analysis.score,
                health: analysis.health,
                total_vulnerabilities: analysis.totalVulns ?? 0,
                total_outdated: analysis.totalOutdated ?? 0,
            },
            risky_dependencies: analysis.risky ?? [],
            outdated_dependencies: analysis.outdated ?? [],
            unstable_dependencies: analysis.unstable ?? [],
        };
    }
    async _processDependencies(file, rawJson, useDocker = false) {
        let deps = {};
        if (rawJson) {
            deps = this._getDependenciesFromJson(rawJson);
        }
        else if (file) {
            deps = this._getDependenciesFromFile(file);
        }
        if (!deps || Object.keys(deps).length === 0) {
            return { dependencyHealth: 100, riskyDependencies: [] };
        }
        const release = await this.analysisSemaphore.acquire();
        try {
            const analysis = await this.dependencyAnalyzer.analyzeDependencies(deps, useDocker ? { useDocker } : undefined);
            return {
                dependencyHealth: typeof analysis?.score === 'number' ? analysis.score : 100,
                riskyDependencies: Array.isArray(analysis?.risky) ? analysis.risky : [],
            };
        }
        finally {
            release();
        }
    }
    async requestWithCache(key, fn, ttlMs = 60_000) {
        const existing = this.cache.get(key);
        const now = Date.now();
        if (existing && now - existing.createdAt < existing.ttlMs) {
            return existing.value;
        }
        const value = await this.requestWithRetry(fn, 3, 300);
        this.cache.set(key, { createdAt: now, ttlMs, value });
        return value;
    }
    async requestWithRetry(fn, attempts = 3, baseDelayMs = 300) {
        let lastErr = null;
        for (let i = 0; i < attempts; i++) {
            try {
                return await fn();
            }
            catch (err) {
                lastErr = err;
                const delay = baseDelayMs * Math.pow(2, i);
                await new Promise((res) => setTimeout(res, delay));
            }
        }
        if (lastErr instanceof Error) {
            throw lastErr;
        }
        else {
            throw new Error('request failed');
        }
    }
    parseGitHubUrl(url) {
        try {
            url = url
                .trim()
                .replace(/\.git$/, '')
                .replace(/\/$/, '');
            const match = url.match(/github\.com[:/](?<owner>[^/]+)\/(?<repo>[^/]+)(?:$|\/)/) ??
                url.match(/git@github\.com:(?<owner>[^/]+)\/(?<repo>[^/]+)/);
            if (!match?.groups) {
                throw new common_1.HttpException('Invalid GitHub repository URL', common_1.HttpStatus.BAD_REQUEST);
            }
            const { owner, repo } = match.groups;
            return { owner, repo };
        }
        catch {
            throw new common_1.HttpException('Invalid GitHub repository URL', common_1.HttpStatus.BAD_REQUEST);
        }
    }
    async fetchRepo(owner, repo, token) {
        try {
            const headers = {
                Accept: 'application/vnd.github.v3+json',
                'User-Agent': 'package-health-service',
            };
            const authToken = token?.trim() || process.env.GITHUB_TOKEN;
            if (authToken) {
                headers['Authorization'] = `Bearer ${authToken}`;
            }
            const url = `https://api.github.com/repos/${owner}/${repo}`;
            const res = await (0, rxjs_1.lastValueFrom)(this.httpService.get(url, { headers }));
            return res.data;
        }
        catch {
            throw new common_1.HttpException('Failed to fetch repository data from GitHub', common_1.HttpStatus.BAD_GATEWAY);
        }
    }
    async fetchCommitActivity(owner, repo, token) {
        try {
            const headers = {
                Accept: 'application/vnd.github+json',
            };
            if (token)
                headers['Authorization'] = `Bearer ${token}`;
            const url = `https://api.github.com/repos/${owner}/${repo}/stats/commit_activity`;
            const res = await (0, rxjs_1.lastValueFrom)(this.httpService.get(url, { headers }));
            if (res.status === 202)
                return [];
            const data = res.data;
            if (!Array.isArray(data))
                return [];
            return data.map((item) => {
                if (typeof item === 'object' &&
                    item !== null &&
                    'week' in item &&
                    'total' in item &&
                    typeof item.week === 'number' &&
                    typeof item.total === 'number') {
                    return {
                        week: item.week,
                        total: item.total,
                    };
                }
                return { week: 0, total: 0 };
            });
        }
        catch {
            return [];
        }
    }
    async fetchSecurityAlerts(owner, repo, token) {
        try {
            const headers = {
                Accept: 'application/vnd.github.v3+json',
            };
            if (token)
                headers['Authorization'] = `Bearer ${token}`;
            const url = `https://api.github.com/repos/${owner}/${repo}/vulnerability-alerts`;
            const res = await (0, rxjs_1.lastValueFrom)(this.httpService.get(url, { headers }));
            if (res.status === 204)
                return [true];
            if (res.status === 404)
                return [];
            return [];
        }
        catch {
            return [];
        }
    }
    _parseJson(rawJson) {
        try {
            const parsed = typeof rawJson === 'string' ? JSON.parse(rawJson) : rawJson;
            if (typeof parsed !== 'object' ||
                parsed === null ||
                Array.isArray(parsed)) {
                throw new Error('Invalid JSON structure');
            }
            return parsed;
        }
        catch {
            throw new common_1.HttpException('Invalid JSON format. Must be a non-null object.', common_1.HttpStatus.BAD_REQUEST);
        }
    }
    _extractDependencies(packageJson) {
        const deps = {};
        const addDeps = (source) => {
            if (typeof source === 'object' && source !== null) {
                for (const [key, value] of Object.entries(source)) {
                    if (typeof value === 'string')
                        deps[key] = value;
                }
            }
        };
        addDeps(packageJson.dependencies);
        addDeps(packageJson.devDependencies);
        return deps;
    }
    _getDependenciesFromJson(rawJson, isLockFile = false) {
        const parsed = this._parseJson(rawJson);
        if (isLockFile) {
            const deps = {};
            const extractDeps = (packages) => {
                if (typeof packages !== 'object' || packages === null)
                    return;
                for (const [name, info] of Object.entries(packages)) {
                    if (typeof info === 'object' &&
                        info !== null &&
                        'version' in info &&
                        typeof info.version === 'string') {
                        deps[name] = info.version;
                        if ('dependencies' in info &&
                            typeof info.dependencies ===
                                'object' &&
                            info.dependencies !== null) {
                            extractDeps(info.dependencies);
                        }
                    }
                }
            };
            if (parsed &&
                typeof parsed === 'object' &&
                'dependencies' in parsed &&
                typeof parsed.dependencies === 'object' &&
                parsed.dependencies !== null) {
                extractDeps(parsed.dependencies);
            }
            return deps;
        }
        return this._extractDependencies(parsed);
    }
    _getDependenciesFromFile(file) {
        const deps = {};
        const isZip = file.mimetype === 'application/zip' || file.originalname.endsWith('.zip');
        if (isZip) {
            try {
                const zip = new adm_zip_1.default(file.buffer);
                const entries = zip.getEntries();
                entries.forEach((entry) => {
                    if (!entry.isDirectory) {
                        const baseName = path_1.default.basename(entry.entryName).toLowerCase();
                        if (baseName === 'package.json' ||
                            baseName === 'package-lock.json') {
                            const buffer = entry.getData();
                            if (!Buffer.isBuffer(buffer))
                                return;
                            const content = buffer.toString('utf-8');
                            const isLock = baseName === 'package-lock.json';
                            const fileDeps = this._getDependenciesFromJson(content, isLock);
                            Object.assign(deps, fileDeps);
                        }
                    }
                });
                if (Object.keys(deps).length === 0) {
                    throw new common_1.HttpException('No package.json or package-lock.json found in the uploaded zip folder.', common_1.HttpStatus.BAD_REQUEST);
                }
                return deps;
            }
            catch {
                throw new common_1.HttpException('Failed to read or parse the uploaded zip folder.', common_1.HttpStatus.BAD_REQUEST);
            }
        }
        if (file.originalname.endsWith('package.json') ||
            file.originalname.endsWith('package-lock.json')) {
            const content = file.buffer.toString('utf-8');
            const isLock = file.originalname.endsWith('package-lock.json');
            return this._getDependenciesFromJson(content, isLock);
        }
        throw new common_1.HttpException('Unsupported file type. Please upload a zip folder or package.json/package-lock.json file.', common_1.HttpStatus.BAD_REQUEST);
    }
    _calculateHealthScore(repo, commitActivity, securityAlerts, dependencyHealth) {
        const WEIGHTS = {
            STARS: 0.2,
            FORKS: 0.15,
            RECENCY: 0.15,
            COMMITS: 0.2,
            DEPENDENCIES: 0.15,
            ISSUES: 0.1,
            SECURITY: 0.05,
        };
        const starsScore = Math.min((repo.stargazers_count ?? 0) / 5000, 1);
        const forksScore = Math.min((repo.forks_count ?? 0) / 1000, 1);
        const daysSinceLastPush = (Date.now() - new Date(repo.pushed_at).getTime()) / (1000 * 60 * 60 * 24);
        const recencyScore = Math.max(0, 1 - daysSinceLastPush / 365);
        const recentCommits = Array.isArray(commitActivity)
            ? commitActivity.slice(-12)
            : [];
        const totalRecentCommits = recentCommits.reduce((sum, week) => sum + (week.total ?? 0), 0);
        const commitScore = Math.min(totalRecentCommits / 100, 1);
        const dependencyScore = Math.min(Math.max(dependencyHealth / 100, 0), 1);
        const issuePenalty = Math.max(0, 1 -
            ((repo.open_issues_count ?? 0) / ((repo.stargazers_count ?? 0) + 1)) *
                0.5);
        const securityPenalty = securityAlerts && securityAlerts.length > 0 ? 0.5 : 1;
        const weighted = (starsScore * WEIGHTS.STARS +
            forksScore * WEIGHTS.FORKS +
            recencyScore * WEIGHTS.RECENCY +
            commitScore * WEIGHTS.COMMITS +
            dependencyScore * WEIGHTS.DEPENDENCIES +
            issuePenalty * WEIGHTS.ISSUES +
            securityPenalty * WEIGHTS.SECURITY) *
            100;
        const score = Math.round(Math.max(0, Math.min(weighted, 100)));
        const label = score >= 80
            ? 'Excellent'
            : score >= 60
                ? 'Good'
                : score >= 40
                    ? 'Moderate'
                    : 'Poor';
        return { score, label };
    }
};
exports.RepoHealthService = RepoHealthService;
exports.RepoHealthService = RepoHealthService = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, mongoose_1.InjectModel)(repo_health_model_1.RepoHealth.name)),
    __metadata("design:paramtypes", [mongoose_2.Model,
        axios_1.HttpService,
        dependency_analyzer_service_1.DependencyAnalyzerService])
], RepoHealthService);
//# sourceMappingURL=repo-health.service.js.map