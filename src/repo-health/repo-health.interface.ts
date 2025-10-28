import { HttpException, HttpStatus } from "@nestjs/common";

export interface GitHubRepoResponse {
  id: number;
  name: string;
  full_name: string;
  owner: {
    login: string;
    id: number;
    avatar_url: string;
    type: string;
  };
  private?: boolean;
  html_url: string;
  description: string | null;
  fork: boolean;
  created_at: string;
  updated_at: string;
  pushed_at: string;
  git_url: string;
  ssh_url: string;
  clone_url: string;
  svn_url: string;
  homepage: string | null;
  size: number;
  stargazers_count: number;
  watchers_count: number;
  language: string | null;
  has_issues: boolean;
  has_projects: boolean;
  has_downloads: boolean;
  has_wiki: boolean;
  has_pages: boolean;
  forks_count: number;
  mirror_url: string | null;
  archived: boolean;
  disabled: boolean;
  open_issues_count: number;
  license: {
    key: string;
    name: string;
    spdx_id: string;
    url: string | null;
  } | null;
  allow_forking: boolean;
  is_template: boolean;
  web_commit_signoff_required: boolean;
  topics: string[];
  visibility: 'public' | 'private';
  forks: number;
  open_issues: number;
  watchers: number;
  default_branch: string;
  permissions?: {
    admin: boolean;
    push: boolean;
    pull: boolean;
  };
}

export interface CommitActivityItem {
  week: number;
  total: number;
  days: number[];
}

export interface OverallHealth {
  score: number;
  label: string;
  metrics: {
    security: number;
    performance: number;
    reliability: number;
    maintainability: number;
  };
}

export interface SecurityAlert {
  id: string;
  number: number;
  state: 'open' | 'fixed' | 'dismissed';
  created_at: string;
  updated_at: string;
  dismissed_at: string | null;
  dismissed_by: any;
  dismissed_reason: string | null;
  dependency: {
    package: {
      ecosystem: string;
      name: string;
    };
    manifest_path: string;
    scope: 'development' | 'runtime';
  };
  security_advisory: {
    ghsa_id: string;
    cve_id: string | null;
    summary: string;
    description: string;
    severity: 'low' | 'medium' | 'high' | 'critical';
    identifiers: Array<{
      type: string;
      value: string;
    }>;
    references: Array<{
      url: string;
    }>;
    published_at: string;
    updated_at: string;
    withdrawn_at: string | null;
    vulnerabilities: Array<{
      package: {
        ecosystem: string;
        name: string;
      };
      severity: string;
      vulnerable_version_range: string;
      first_patched_version: string | null;
    }>;
  };
  security_vulnerability: {
    package: {
      ecosystem: string;
      name: string;
    };
    severity: string;
    vulnerable_version_range: string;
    first_patched_version: string | null;
  };
  url: string;
  html_url: string;
}

export interface DependencyAnalysisResult {
  dependencyHealth: number;
  riskyDependencies: string[];
  bundleSize: number;
  licenseRisks: string[];
  popularity: number;
  daysBehind: number;
}

export interface CacheEntry<T> {
  createdAt: number;
  ttlMs: number;
  value: T;
}

export interface RepositoryHealthData {
  repo_id: string;
  owner: string;
  repo: string;
  name: string;
  stars: number;
  forks: number;
  open_issues: number;
  last_pushed: Date;
  commit_activity: number[];
  security_alerts: number;
  dependency_health: number;
  risky_dependencies: string[];
  overall_health: {
    score: number;
    label: string;
    metrics: {
      security: number;
      performance: number;
      reliability: number;
      maintainability: number;
      [key: string]: number;
    };
  };
  bundle_size: number;
  license_risks: string[];
  popularity: number;
  days_behind: number;
}


// Custom exceptions
export class RepositoryNotFoundException extends HttpException {
  constructor(owner: string, repo: string) {
    super(`Repository '${owner}/${repo}' not found`, HttpStatus.NOT_FOUND);
  }
}

export class InvalidTokenException extends HttpException {
  constructor() {
    super('Invalid or expired GitHub token', HttpStatus.UNAUTHORIZED);
  }
}

export class RateLimitExceededException extends HttpException {
  constructor(resetTime: Date) {
    super(
      `Rate limit exceeded. Resets at ${resetTime.toISOString()}`,
      HttpStatus.TOO_MANY_REQUESTS,
    );
  }
}

export class PrivateRepositoryException extends HttpException {
  constructor(owner: string, repo: string) {
    super(
      `Repository '${owner}/${repo}' is private and requires a token`,
      HttpStatus.BAD_REQUEST,
    );
  }
}
