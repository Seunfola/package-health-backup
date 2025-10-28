import { Test, TestingModule } from '@nestjs/testing';
import { getModelToken } from '@nestjs/mongoose';
import { RepoHealthDocument } from '../repo-health.model';
import { RepoHealthService } from '../services/repo-health.service';
import { GithubApiService } from '../services/github-api.service';
import { DependencyAnalysisService } from '../services/dependency-analysis.service';
import { HealthCalculatorService } from '../services/health-calculator.service';
import { RepositoryDataService } from '../services/repository-data.service';

// Simplified helper type to safely mock RepoHealth
type PartialRepoHealth = Partial<RepoHealthDocument> & Record<string, any>;

class MockGithubApiService {
  async fetchPublicRepositoryData() {
    return {
      name: 'test-repo',
      stargazers_count: 100,
      forks_count: 50,
      open_issues_count: 10,
      pushed_at: '2023-01-01T00:00:00Z',
    };
  }

  async fetchPublicCommitActivity() {
    return [{ total: 10 }, { total: 20 }, { total: 15 }];
  }

  async fetchPublicSecurityAlerts() {
    return [{ severity: 'high' }, { severity: 'medium' }];
  }

  async fetchPrivateRepositoryData() {
    return {
      name: 'private-repo',
      stargazers_count: 50,
      forks_count: 25,
      open_issues_count: 5,
      pushed_at: '2023-01-01T00:00:00Z',
    };
  }

  async fetchPrivateCommitActivity() {
    return [{ total: 5 }, { total: 15 }];
  }

  async fetchPrivateSecurityAlerts() {
    return [{ severity: 'high' }];
  }

  async determineRepoVisibility(_: string, __: string, token?: string) {
    return token ? 'private' : 'public';
  }
}

class MockDependencyAnalysisService {
  async analyzeDependencies() {
    return {
      dependencyHealth: 85,
      riskyDependencies: ['vulnerable-pkg@1.0.0', 'outdated-lib@2.1.0'],
      bundleSize: 2048,
      licenseRisks: ['GPL-3.0', 'AGPL-1.0'],
      popularity: 92,
      daysBehind: 7,
    };
  }
}

class MockHealthCalculatorService {
  calculateHealthScore(
    repoData: any,
    commitActivity: any[],
    securityAlerts: any[],
    dependencyHealth: number,
  ) {
    return {
      score: 88,
      metrics: {
        activity: 85,
        security: 90,
        maintenance: 82,
        popularity: 95,
        dependencies: dependencyHealth,
      },
    };
  }
}

class MockRepositoryDataService {
  async findOne(repoId: string): Promise<RepoHealthDocument | null> {
    if (repoId === 'owner/existing-repo') {
      return {
        repo_id: 'owner/existing-repo',
        owner: 'owner',
        repo: 'existing-repo',
        name: 'existing-repo',
        stars: 100,
        forks: 50,
        open_issues: 10,
        last_pushed: new Date('2023-01-01T00:00:00Z'),
        overall_health: {
          score: 85,
          label: 'good',
        },
        commit_activity: [10, 20, 15],
        security_alerts: 2,
        dependency_health: 85,
        risky_dependencies: ['vulnerable-pkg@1.0.0'],
        bundle_size: 1024,
        license_risks: ['MIT'],
        popularity: 90,
        days_behind: 5,
        createdAt: new Date(),
      } as unknown as RepoHealthDocument;
    }
    return null;
  }

  async findAll() {
    return {
      data: [
        {
          repo_id: 'owner/repo1',
          owner: 'owner',
          repo: 'repo1',
          name: 'repo1',
          stars: 100,
          forks: 50,
          open_issues: 10,
          overall_health: {
            score: 85,
            label: 'good',
          },
          dependency_health: 85,
          createdAt: new Date(),
        },
      ],
      total: 1,
      page: 1,
      limit: 10,
      totalPages: 1,
    };
  }

  async findByOwner(owner: string): Promise<RepoHealthDocument[]> {
    return [
      {
        repo_id: `${owner}/repo1`,
        owner,
        repo: 'repo1',
        name: 'repo1',
        stars: 100,
        forks: 50,
        open_issues: 10,
        overall_health: {
          score: 85,
          label: 'good',
        },
        commit_activity: [10, 20, 15],
        security_alerts: 2,
        dependency_health: 85,
        risky_dependencies: ['vulnerable-pkg@1.0.0'],
        bundle_size: 1024,
        license_risks: ['MIT'],
        popularity: 90,
        days_behind: 5,
        createdAt: new Date(),
      } as unknown as RepoHealthDocument,
    ];
  }

  async getStats() {
    return {
      totalRepos: 10,
      averageHealth: 82.5,
      healthDistribution: {
        excellent: 2,
        good: 5,
        fair: 2,
        poor: 1,
      },
      mostPopularRepo: 'owner/most-popular',
      leastHealthyRepo: 'owner/needs-work',
    };
  }

  async upsertRepoHealth(
    repoId: string,
    data: any,
  ): Promise<RepoHealthDocument> {
    return {
      ...data,
      _id: '507f1f77bcf86cd799439011',
      createdAt: new Date(),
    } as unknown as RepoHealthDocument;
  }
}

// TEST SUITE
describe('RepoHealthService Integration', () => {
  let service: RepoHealthService;
  let healthCalculatorService: MockHealthCalculatorService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        RepoHealthService,
        { provide: GithubApiService, useClass: MockGithubApiService },
        { provide: DependencyAnalysisService, useClass: MockDependencyAnalysisService },
        { provide: HealthCalculatorService, useClass: MockHealthCalculatorService },
        { provide: RepositoryDataService, useClass: MockRepositoryDataService },
        {
          provide: getModelToken('RepoHealth'),
          useValue: {
            findOne: () => ({ exec: () => Promise.resolve(null) }),
            find: () => ({ sort: () => ({ skip: () => ({ limit: () => ({ exec: () => Promise.resolve([]) }) }) }) }),
            countDocuments: () => ({ exec: () => Promise.resolve(0) }),
          },
        },
      ],
    }).compile();

    service = module.get<RepoHealthService>(RepoHealthService);
    healthCalculatorService = module.get<MockHealthCalculatorService>(HealthCalculatorService);
  });

  it('should analyze public repository correctly', async () => {
    const result = await service.analyzePublicRepository('owner', 'repo');
    expect(result.overall_health.score).toBe(88);
    expect(result.overall_health.metrics.security).toBeDefined();
    expect(result.overall_health.metrics.performance).toBeDefined();
    expect(result.overall_health.metrics.reliability).toBeDefined();
    expect(result.overall_health.metrics.maintainability).toBeDefined();
  });

  it('should call calculateHealthScore with proper arguments', async () => {
    const spy = jest.spyOn(healthCalculatorService, 'calculateHealthScore');
    await service.analyzePublicRepository('owner', 'repo');
    expect(spy).toHaveBeenCalledWith(
      expect.objectContaining({ name: 'test-repo', stargazers_count: 100 }),
      expect.any(Array),
      expect.any(Array),
      85,
    );
  });
});


