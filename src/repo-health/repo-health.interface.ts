// interfaces/github.interface.ts
export interface GitHubRepoResponse {
  name: string;
  owner: { login: string };
  stargazers_count: number;
  forks_count: number;
  open_issues_count: number;
  pushed_at: string;
  private?: boolean;
}

export interface CommitActivityItem {
  week: number;
  total: number;
}

export type DependencyAnalysisResult = {
  dependencyHealth: number;
  riskyDependencies: string[];
  bundleSize: number;
  licenseRisks: string[];
  popularity: number;
  daysBehind: number;
};

export type CacheEntry<T> = { createdAt: number; ttlMs: number; value: T };
