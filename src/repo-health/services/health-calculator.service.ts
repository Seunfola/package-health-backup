import { Injectable } from '@nestjs/common';
import {
  CommitActivityItem,
  GitHubRepoResponse,
  OverallHealth,
} from '../repo-health.interface';

@Injectable()
export class HealthCalculatorService {
  calculateHealthScore(
    repo: GitHubRepoResponse,
    commitActivity: CommitActivityItem[],
    securityAlerts: any[],
    dependencyHealth: number,
  ): OverallHealth {
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
    const daysSinceLastPush =
      (Date.now() - new Date(repo.pushed_at).getTime()) / (1000 * 60 * 60 * 24);
    const recencyScore = Math.max(0, 1 - daysSinceLastPush / 365);
    const totalRecentCommits = commitActivity.reduce(
      (sum, week) => sum + (week.total ?? 0),
      0,
    );
    const commitScore = Math.min(totalRecentCommits / 100, 1);
    const dependencyScore = Math.min(Math.max(dependencyHealth / 100, 0), 1);
    const issuePenalty = Math.max(
      0,
      1 -
        ((repo.open_issues_count ?? 0) / ((repo.stargazers_count ?? 0) + 1)) *
          0.5,
    );
    const securityPenalty = securityAlerts.length > 0 ? 0.5 : 1;

    const metrics = {
      security: Math.round(securityPenalty * 100),
      popularity: Math.round(starsScore * 100),
      activity: Math.round(commitScore * 100),
      maintainability: Math.round(dependencyScore * 100),
    };
    const weighted =
      (starsScore * WEIGHTS.STARS +
        forksScore * WEIGHTS.FORKS +
        recencyScore * WEIGHTS.RECENCY +
        commitScore * WEIGHTS.COMMITS +
        dependencyScore * WEIGHTS.DEPENDENCIES +
        issuePenalty * WEIGHTS.ISSUES +
        securityPenalty * WEIGHTS.SECURITY) *
      100;

    const score = Math.round(Math.max(0, Math.min(weighted, 100)));

    const label =
      score >= 80
        ? 'Excellent'
        : score >= 60
          ? 'Good'
          : score >= 40
            ? 'Moderate'
            : 'Poor';

    const fixedMetrics = {
      security: metrics.security,
      performance: 0,
      reliability: 0,
      maintainability: metrics.maintainability,
    };

    return { score, label, metrics: fixedMetrics };
  }
}
