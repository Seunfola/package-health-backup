import { Test, TestingModule } from '@nestjs/testing';
import { HttpException, HttpStatus } from '@nestjs/common';
import { getModelToken } from '@nestjs/mongoose';
import { RepoHealthDocument } from '../repo-health.model';
import { RepoHealthService } from '../services/repo-health.service';
import { GithubApiService } from '../services/github-api.service';
import { DependencyAnalysisService } from '../services/dependency-analysis.service';
import { HealthCalculatorService } from '../services/health-calculator.service';
import { RepositoryDataService } from '../services/repository-data.service';


// Mock implementations that match the complete schema
class MockGithubApiService {
  async fetchPublicRepositoryData(owner: string, repo: string) {
    return {
      name: 'test-repo',
      stargazers_count: 100,
      forks_count: 50,
      open_issues_count: 10,
      pushed_at: '2023-01-01T00:00:00Z',
    };
  }

  async fetchPublicCommitActivity(owner: string, repo: string) {
    return [{ total: 10 }, { total: 20 }, { total: 15 }];
  }

  async fetchPublicSecurityAlerts(owner: string, repo: string) {
    return [{ severity: 'high' }, { severity: 'medium' }];
  }

  async fetchPrivateRepositoryData(owner: string, repo: string, token: string) {
    return {
      name: 'private-repo',
      stargazers_count: 50,
      forks_count: 25,
      open_issues_count: 5,
      pushed_at: '2023-01-01T00:00:00Z',
    };
  }

  async fetchPrivateCommitActivity(owner: string, repo: string, token: string) {
    return [{ total: 5 }, { total: 15 }];
  }

  async fetchPrivateSecurityAlerts(owner: string, repo: string, token: string) {
    return [{ severity: 'high' }];
  }

  async determineRepoVisibility(owner: string, repo: string, token?: string) {
    return token ? 'private' : 'public';
  }
}

class MockDependencyAnalysisService {
  async analyzeDependencies(
    file?: Express.Multer.File,
    rawJson?: string | Record<string, unknown>,
  ) {
    return {
      dependencyHealth: { score: 85 },
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
      // Mimic a real RepoHealthDocument by including required mongoose document stubs
      return {
        _id: 'mockedid1234567890',
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
          metrics: {
            activity: 80,
            security: 90,
            maintenance: 85,
            popularity: 75,
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
        createdAt: new Date('2023-01-01T00:00:00Z'),
        updatedAt: new Date('2023-01-01T00:00:00Z'),
        // --- Mongoose Document mock methods/properties ---
        $isDefault: () => false,
        $isDeleted: () => false,
        $session: () => null,
        $locals: {},
        $getAllSubdocs: () => [],
        depopulate: () => this,
        $ignore: () => {},
        $isEmpty: () => false,
        $markValid: () => {},
        $isFullPath: () => true,
        $model: () => {},
        $op: null,
        $set: () => this,
        $where: () => this,
        $assertPopulated: () => {},
        $clone: () => this,
        $getPopulatedDocs: () => [],
        $id: 'mockedid1234567890',
        $isModified: () => false,
        $markModified: () => {},
        $parent: () => null,
        $populated: () => ({}),
        $setPopulated: () => {},
        $toObject: () => this,
        $toJSON: () => this,
        $errors: undefined,
        $get: (path: string) => (this as any)[path],
        $init: () => {},
        $isNew: false,
        $isSubdocument: false,
        $isValid: true,
        $ownerDocument: () => this,
        $save: async () => this,
        $validate: async () => {},
      } as unknown as RepoHealthDocument;
    }
    return null;
  }

  async findAll(page?: number, limit?: number, sort?: string) {
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
            },
          },
          dependency_health: 85,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ],
      total: 1,
      page: page || 1,
      limit: limit || 10,
      totalPages: 1,
    };
  }

  async findByOwner(owner: string): Promise<RepoHealthDocument[]> {
    function makeFakeRepoHealth(overrides: Partial<any> = {}): RepoHealthDocument {
      const base: any = {
        repo_id: `${owner}/repo1`,
        owner,
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
          },
        },
        dependency_health: 85,
        createdAt: new Date(),
        updatedAt: new Date(),
        last_pushed: new Date(),
        commit_activity: [],
        security_alerts: [],
        risky_dependencies: [],
        dependents_count: 0,
        releases: [],
        languages: [],
        contributors: [],
        readme_present: true,
        license: 'MIT',
        open_prs: 2,
        closed_prs: 5,
        merged_prs: 3,
        is_archived: false,
        default_branch: 'main',
        size: 289,
        watchers: 10,
        subscribers: 3,
        homepage: '',
        topics: [],
        has_wiki: true,
        has_pages: false,
        has_discussions: false,
        has_issues: true,
        health_score_history: [],
        ...overrides,
      };

      // fake minimal mongoose document properties
      return {
        ...base,
        _id: 'fakeid',
        $locals: {},
        $parent: () => null,
        $populated: () => ({}),
        $setPopulated: () => {},
        $toObject: () => base,
        $toJSON: () => base,
        $errors: undefined,
        $get: (path: string) => (base as any)[path],
        $init: () => {},
        $isNew: false,
        $isSubdocument: false,
        $isValid: true,
        $ownerDocument: () => base,
        $save: async () => base,
        $validate: async () => {},
      } as unknown as RepoHealthDocument;
    }

    return [makeFakeRepoHealth()];
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
    } as RepoHealthDocument;
  }
}

describe('RepoHealthService Integration', () => {
  let service: any;
  let githubApiService: any;
  let dependencyAnalysisService: any;
  let healthCalculatorService: any;
  let repositoryDataService: any;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        RepoHealthService,
        {
          provide: GithubApiService,
          useClass: MockGithubApiService,
        },
        {
          provide: DependencyAnalysisService,
          useClass: MockDependencyAnalysisService,
        },
        {
          provide: HealthCalculatorService,
          useClass: MockHealthCalculatorService,
        },
        {
          provide: RepositoryDataService,
          useClass: MockRepositoryDataService,
        },
        {
          provide: getModelToken('RepoHealth'),
          useValue: {
            findOne: () => ({ exec: () => Promise.resolve(null) }),
            find: () => ({
              sort: () => ({
                skip: () => ({
                  limit: () => ({
                    exec: () => Promise.resolve([]),
                  }),
                }),
              }),
            }),
            countDocuments: () => ({ exec: () => Promise.resolve(0) }),
          },
        },
      ],
    }).compile();

    service = module.get<RepoHealthService>(RepoHealthService);
    githubApiService = module.get<GithubApiService>(GithubApiService);
    dependencyAnalysisService = module.get<DependencyAnalysisService>(
      DependencyAnalysisService,
    );
    healthCalculatorService = module.get<HealthCalculatorService>(
      HealthCalculatorService,
    );
    repositoryDataService = module.get<RepositoryDataService>(
      RepositoryDataService,
    );
  });

  describe('analyzePublicRepository', () => {
    it('should successfully analyze public repository with complete schema', async () => {
      // Execute
      const result = await service.analyzePublicRepository('owner', 'repo');

      // Assert - Verify all schema fields are present
      expect(result).toMatchObject({
        repo_id: 'owner/repo',
        owner: 'owner',
        repo: 'repo',
        name: 'test-repo',
        stars: 100,
        forks: 50,
        open_issues: 10,
        last_pushed: expect.any(Date),
        commit_activity: [10, 20, 15],
        security_alerts: 2,
        dependency_health: 85,
        risky_dependencies: ['vulnerable-pkg@1.0.0', 'outdated-lib@2.1.0'],
        overall_health: {
          score: 88,
          metrics: {
            activity: 85,
            security: 90,
            maintenance: 82,
            popularity: 95,
            dependencies: 85,
          },
        },
        bundle_size: 2048,
        license_risks: ['GPL-3.0', 'AGPL-1.0'],
        popularity: 92,
        days_behind: 7,
        createdAt: expect.any(Date),
        updatedAt: expect.any(Date),
      });
    });

    it('should compute health score with all metrics', async () => {
      // Setup
      const calculateHealthSpy = jest.spyOn(
        healthCalculatorService,
        'calculateHealthScore',
      );

      // Execute
      await service.analyzePublicRepository('owner', 'repo');

      // Assert
      expect(calculateHealthSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          name: 'test-repo',
          stargazers_count: 100,
          forks_count: 50,
        }),
        [{ total: 10 }, { total: 20 }, { total: 15 }],
        [{ severity: 'high' }, { severity: 'medium' }],
        85,
      );
    });
  });

  describe('analyzePrivateRepository', () => {
    it('should analyze private repository with token and complete schema', async () => {
      // Setup
      const token = 'ghp_testtoken';

      // Execute
      const result = await service.analyzePrivateRepository(
        'owner',
        'private-repo',
        token,
      );

      // Assert
      expect(result).toMatchObject({
        repo_id: 'owner/private-repo',
        owner: 'owner',
        repo: 'private-repo',
        security_alerts: 1, // From private security alerts
        overall_health: expect.objectContaining({
          score: 88,
        }),
      });
    });
  });

  describe('Data access methods with complete schema', () => {
    it('should find repo health with all fields', async () => {
      // Execute
      const result = await service.findRepoHealth('owner', 'existing-repo');

      // Assert
      expect(result).toMatchObject({
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
      });
    });

    it('should return all repositories with complete data', async () => {
      // Execute
      const result = await service.findAll(1, 10, 'stars');

      // Assert
      expect(result.data[0]).toMatchObject({
        repo_id: 'owner/repo1',
        owner: 'owner',
        repo: 'repo1',
        name: 'repo1',
        stars: 100,
        forks: 50,
        open_issues: 10,
        overall_health: expect.any(Object),
        dependency_health: 85,
      });
    });

    it('should return repositories by owner with complete schema', async () => {
      // Execute
      const result = await service.findByOwner('test-owner');

      // Assert
      expect(result[0]).toMatchObject({
        repo_id: 'test-owner/repo1',
        owner: 'test-owner',
        repo: 'repo1',
        name: 'repo1',
        stars: 100,
        forks: 50,
        open_issues: 10,
        overall_health: expect.any(Object),
      });
    });

    it('should return complete stats', async () => {
      // Execute
      const result = await service.getStats();

      // Assert
      expect(result).toMatchObject({
        totalRepos: 10,
        averageHealth: 82.5,
        healthDistribution: {
          excellent: 2,
          good: 5,
          fair: 2,
          poor: 1,
        },
      });
    });
  });

  describe('Batch operations with complete data', () => {
    it('should process multiple repositories with complete analysis', async () => {
      // Setup
      const requests = [
        {
          url: 'https://github.com/owner1/repo1',
          token: 'ghp_token1',
        },
        {
          url: 'https://github.com/owner2/repo2',
        },
      ];

      // Execute
      const results = await service.analyzeMultipleRepositories(requests, 2);

      // Assert
      expect(results).toHaveLength(2);
      expect(results[0]).toMatchObject({
        url: 'https://github.com/owner1/repo1',
        data: expect.objectContaining({
          repo_id: 'owner1/repo1',
          overall_health: expect.any(Object),
        }),
      });
      expect(results[1]).toMatchObject({
        url: 'https://github.com/owner2/repo2',
        data: expect.objectContaining({
          repo_id: 'owner2/repo2',
          overall_health: expect.any(Object),
        }),
      });
    });
  });

  describe('Utility methods', () => {
    it('should process dependencies independently', async () => {
      // Execute
      const result = await service.processDependencies();

      // Assert
      expect(result).toMatchObject({
        dependencyHealth: { score: 85 },
        riskyDependencies: expect.any(Array),
        bundleSize: 2048,
        licenseRisks: expect.any(Array),
        popularity: 92,
        daysBehind: 7,
      });
    });

    it('should calculate health score directly', async () => {
      // Setup
      const repoData = { stargazers_count: 100 };
      const commitActivity = [{ total: 10 }];
      const securityAlerts = [{ severity: 'high' }];
      const dependencyHealth = 85;

      // Execute
      const result = service.calculateHealthScore(
        repoData,
        commitActivity,
        securityAlerts,
        dependencyHealth,
      );

      // Assert
      expect(result).toEqual({
        score: 88,
        metrics: expect.any(Object),
      });
    });
  });
});
