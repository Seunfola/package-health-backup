import { Model } from 'mongoose';
import { HttpService } from '@nestjs/axios';
import { DependencyAnalyzerService } from './dependency-analyzer.service';
import { RepoHealth, RepoHealthDocument } from './repo-health.model';
interface GitHubRepoResponse {
    name: string;
    owner: {
        login: string;
    };
    stargazers_count: number;
    forks_count: number;
    open_issues_count: number;
    pushed_at: string;
}
interface CommitActivityItem {
    week: number;
    total: number;
}
export declare class RepoHealthService {
    private readonly repoHealthModel;
    private readonly httpService;
    private readonly dependencyAnalyzer;
    private readonly analysisSemaphore;
    private readonly cache;
    private readonly dockerAvailable;
    constructor(repoHealthModel: Model<RepoHealthDocument>, httpService: HttpService, dependencyAnalyzer: DependencyAnalyzerService);
    private detectDocker;
    findOne(owner: string, repo: string): Promise<RepoHealthDocument | null>;
    findMany(query: {
        owner?: string;
        repo?: string;
        minHealthScore?: number;
        limit?: number;
        offset?: number;
    }): Promise<RepoHealthDocument[]>;
    findAll(): Promise<RepoHealthDocument[]>;
    getAllRepoStatuses(): Promise<any[]>;
    findRepoHealth(owner: string, repo: string): Promise<RepoHealth & import("mongoose").Document<unknown, any, any, Record<string, any>, {}> & Required<{
        _id: unknown;
    }> & {
        __v: number;
    }>;
    analyzeRepo(owner: string, repo: string, file?: Express.Multer.File, rawJson?: string | Record<string, unknown>, token?: string): Promise<RepoHealth & import("mongoose").Document<unknown, any, any, Record<string, any>, {}> & Required<{
        _id: unknown;
    }> & {
        __v: number;
    }>;
    processDependencies(file?: Express.Multer.File, rawJson?: string | Record<string, unknown>): Promise<{
        dependencyHealth: number;
        riskyDependencies: string[];
    }>;
    getCommitActivity(owner: string, repo: string, token?: string): Promise<CommitActivityItem[]>;
    getSecurityAlerts(owner: string, repo: string, token?: string): Promise<any[]>;
    calculateHealthScore(data: GitHubRepoResponse, commitActivity: {
        week: number;
        total: number;
    }[], securityAlerts: any[], dependencyHealth: number): {
        score: number;
        label: string;
    };
    analyzeByUrl(url: string, file?: Express.Multer.File, rawJson?: string | Record<string, unknown>, token?: string): Promise<RepoHealth & import("mongoose").Document<unknown, any, any, Record<string, any>, {}> & Required<{
        _id: unknown;
    }> & {
        __v: number;
    }>;
    analyzeJson(rawJson: string | Record<string, unknown>): Promise<{
        project_name: string;
        total_dependencies: number;
        dependencies: Record<string, string>;
        dependency_health: {
            score: number;
            health: string;
            total_vulnerabilities: number;
            total_outdated: number;
        };
        risky_dependencies: string[];
        outdated_dependencies: {
            name: string;
            current: string;
            latest: string;
        }[];
        unstable_dependencies: string[];
    }>;
    private _processDependencies;
    private requestWithCache;
    private requestWithRetry;
    private parseGitHubUrl;
    private fetchRepo;
    private fetchCommitActivity;
    private fetchSecurityAlerts;
    private _parseJson;
    private _extractDependencies;
    private _getDependenciesFromJson;
    _getDependenciesFromFile(file: Express.Multer.File): Record<string, string>;
    private _calculateHealthScore;
}
export {};
