import { RepoHealthService } from './repo-health.service';
interface UrlBody {
    url: string;
    token?: string;
}
interface OwnerRepoBody {
    owner: string;
    repo: string;
}
export declare class RepoHealthController {
    private readonly repoHealthService;
    constructor(repoHealthService: RepoHealthService);
    analyzeByUrl(body: UrlBody): Promise<import("./repo-health.model").RepoHealth & import("mongoose").Document<unknown, any, any, Record<string, any>, {}> & Required<{
        _id: unknown;
    }> & {
        __v: number;
    }>;
    analyzeUploadedPackage(file?: Express.Multer.File): Promise<{
        project_name: string;
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
    }>;
    analyzePastedPackage(json: string): Promise<{
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
    fetchStoredRepo(body: OwnerRepoBody): Promise<import("./repo-health.model").RepoHealth & import("mongoose").Document<unknown, any, any, Record<string, any>, {}> & Required<{
        _id: unknown;
    }> & {
        __v: number;
    }>;
}
export {};
