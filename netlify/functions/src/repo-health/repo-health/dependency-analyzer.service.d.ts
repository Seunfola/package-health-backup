interface DependencyAnalysisResult {
    score: number;
    health: string;
    totalVulns: number;
    totalOutdated: number;
    risky: string[];
    vulnerabilities: Record<string, {
        severity: string;
        via: string[];
    }>;
    outdated: {
        name: string;
        current: string;
        latest: string;
    }[];
    unstable: string[];
}
export declare class DependencyAnalyzerService {
    analyzeDependencies(deps: Record<string, string>, options?: {
        useDocker?: boolean;
    }): Promise<DependencyAnalysisResult>;
    private safeExec;
    private safeJsonExec;
    private extractVulnerabilities;
    private extractOutdated;
    private calculateHealthScore;
    private detectUnstableDeps;
    private cleanupDirectory;
}
export {};
