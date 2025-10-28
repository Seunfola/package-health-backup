import { Test, TestingModule } from '@nestjs/testing';
import { getModelToken } from '@nestjs/mongoose';
import { RepoHealthDocument } from '../repo-health.model';
import { RepoHealthService } from '../services/repo-health.service';
import { GithubApiService } from '../services/github-api.service';
import { DependencyAnalysisService } from '../services/dependency-analysis.service';
import { HealthCalculatorService } from '../services/health-calculator.service';
import { RepositoryDataService } from '../services/repository-data.service';
import { HttpException } from '@nestjs/common';

type PartialRepoHealth = Partial<RepoHealthDocument> & Record<string, any>;

class MockGithubApiService {
  async fetchPublicRepositoryData() {
    return {
      name: 'public-repo',
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
  async analyzeDependencies(
    file?: Express.Multer.File,
    rawJson?: any,
    token?: string,
  ) {
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
        overall_health: {
          score: 85,
          metrics: {
            activity: 80,
            security: 90,
            maintenance: 85,
            popularity: 75,
            dependencies: 85,
          },
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
        updatedAt: new Date(),
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
            metrics: {
              activity: 80,
              security: 90,
              maintenance: 85,
              popularity: 75,
              dependencies: 85,
            },
          },
          dependency_health: 85,
          createdAt: new Date(),
          updatedAt: new Date(),
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
          metrics: {
            activity: 80,
            security: 90,
            maintenance: 85,
            popularity: 75,
            dependencies: 85,
          },
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
        updatedAt: new Date(),
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
      updatedAt: new Date(),
    } as unknown as RepoHealthDocument;
  }
}

describe('RepoHealthService Functional', () => {
  let service: RepoHealthService;
  let calculator: MockHealthCalculatorService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        RepoHealthService,
        { provide: GithubApiService, useClass: MockGithubApiService },
        {
          provide: DependencyAnalysisService,
          useClass: MockDependencyAnalysisService,
        },
        {
          provide: HealthCalculatorService,
          useClass: MockHealthCalculatorService,
        },
        { provide: RepositoryDataService, useClass: MockRepositoryDataService },
        {
          provide: getModelToken('RepoHealth'),
          useValue: {
            findOne: () => ({ exec: () => Promise.resolve(null) }),
            find: () => ({
              sort: () => ({
                skip: () => ({
                  limit: () => ({ exec: () => Promise.resolve([]) }),
                }),
              }),
            }),
            countDocuments: () => ({ exec: () => Promise.resolve(0) }),
          },
        },
      ],
    }).compile();

    service = module.get<RepoHealthService>(RepoHealthService);
    calculator = module.get<MockHealthCalculatorService>(
      HealthCalculatorService,
    );
  });

  it('should analyze a public repository successfully', async () => {
    const result = await service.analyzePublicRepository('facebook', 'react');
    expect(result.repo_id).toBe('facebook/react');
    expect(result.overall_health.score).toBeGreaterThan(0);
    expect(result.bundle_size).toBe(2048);
  });

  it('should throw error if private repo is analyzed without token', async () => {
    await expect(
      service.analyzePrivateRepository('owner', 'private-repo'),
    ).rejects.toThrow('Token is required for private repository');
  });

  it('should analyze private repository when token is provided', async () => {
    const result = await service.analyzePrivateRepository(
      'owner',
      'private-repo',
      'valid-token',
    );
    expect(result.repo_id).toBe('owner/private-repo');
    expect(result.overall_health.score).toBe(88);
    expect(result.overall_health.metrics.security).toBe(90);
  });

  it('should call calculateHealthScore correctly', async () => {
    const spy = jest.spyOn(calculator, 'calculateHealthScore');
    await service.analyzePublicRepository('owner', 'repo');
    expect(spy).toHaveBeenCalledWith(
      expect.objectContaining({ name: 'public-repo' }),
      expect.any(Array),
      expect.any(Array),
      85,
    );
  });

  it('should include security alerts in public repo analysis', async () => {
    const result = await service.analyzePublicRepository('owner', 'repo');
    expect(result.security_alerts).toBe(2);
    expect(result.overall_health.metrics.security).toBeGreaterThan(0);
  });

  it('should include security alerts in private repo analysis with token', async () => {
    const result = await service.analyzePrivateRepository(
      'owner',
      'private-repo',
      'valid-token',
    );
    expect(result.security_alerts).toBe(1);
    expect(result.overall_health.metrics.security).toBe(90);
  });


  it('should reflect security alerts in health score calculation', async () => {
    const spy = jest.spyOn(calculator, 'calculateHealthScore');
    await service.analyzePublicRepository('owner', 'repo');
    expect(spy).toHaveBeenCalledWith(
      expect.any(Object),
      expect.any(Array),
      expect.arrayContaining([{ severity: 'high' }, { severity: 'medium' }]),
      expect.any(Number),
    );
  });


  describe('Data Persistence', () => {
    it('should maintain consistent repo health structure', async () => {
      const result = await service.analyzePublicRepository(
        'microsoft',
        'vscode',
      );
      expect(result.repo_id).toBe('microsoft/vscode');
      expect(result.overall_health.score).toBeGreaterThan(0);
    });

    it('should return valid repository stats', async () => {
      const stats = await service.getStats();
      expect(stats.totalRepos).toBeGreaterThan(0);
      expect(stats.averageHealth).toBeGreaterThan(0);
      expect(stats.healthDistribution.good).toBeGreaterThan(0);
    });
  });
});
