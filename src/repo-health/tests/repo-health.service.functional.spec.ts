// repo-health.service.functional.spec.ts
import { Test, TestingModule } from '@nestjs/testing';
import { RepoHealthService } from '../services/repo-health.service';
import { RepositoryDataService } from '../services/repository-data.service';
import { GithubApiService } from '../services/github-api.service';
import { DependencyAnalysisService } from '../services/dependency-analysis.service';
import { HealthCalculatorService } from '../services/health-calculator.service';


// Enhanced mock services that handle the complete schema
class MockGithubApiService {
  async fetchPublicRepositoryData(owner: string, repo: string) {
    return {
      name: `${repo}`,
      stargazers_count: Math.floor(Math.random() * 1000) + 100,
      forks_count: Math.floor(Math.random() * 500) + 50,
      open_issues_count: Math.floor(Math.random() * 50) + 5,
      pushed_at: new Date().toISOString(),
    };
  }

  async fetchPublicCommitActivity(owner: string, repo: string) {
    return Array.from({ length: 4 }, (_, i) => ({
      total: Math.floor(Math.random() * 100) + 10,
    }));
  }

  async fetchPublicSecurityAlerts(owner: string, repo: string) {
    return repo.includes('vulnerable')
      ? [{ severity: 'high' }, { severity: 'medium' }]
      : [];
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
    const hasRisks = file || rawJson;

    return {
      dependencyHealth: { score: hasRisks ? 75 : 90 },
      riskyDependencies: hasRisks ? ['vulnerable-pkg@1.0.0'] : [],
      bundleSize: 2048,
      licenseRisks: hasRisks ? ['GPL-3.0'] : ['MIT'],
      popularity: hasRisks ? 80 : 95,
      daysBehind: hasRisks ? 15 : 2,
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
    const activityScore =
      commitActivity.reduce((sum, item) => sum + item.total, 0) /
      commitActivity.length;
    const securityScore =
      securityAlerts.length === 0
        ? 100
        : Math.max(0, 100 - securityAlerts.length * 10);

    return {
      score: Math.round((activityScore + securityScore + dependencyHealth) / 3),
      metrics: {
        activity: Math.round(activityScore),
        security: securityScore,
        maintenance: dependencyHealth,
        popularity: repoData.stargazers_count > 500 ? 95 : 75,
      },
    };
  }
}

class MockRepositoryDataService {
  private mockData = new Map();

  async findOne(repoId: string) {
    return this.mockData.get(repoId) || null;
  }

  async upsertRepoHealth(repoId: string, data: any) {
    const record = {
      ...data,
      _id: `mock_${repoId.replace('/', '_')}`,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    this.mockData.set(repoId, record);
    return record;
  }

  async findAll(page = 1, limit = 10, sort = 'stars') {
    const data = Array.from(this.mockData.values());
    return {
      data: data.slice((page - 1) * limit, page * limit),
      total: data.length,
      page,
      limit,
      totalPages: Math.ceil(data.length / limit),
    };
  }

  async findByOwner(owner: string) {
    return Array.from(this.mockData.values()).filter(
      (repo: any) => repo.owner === owner,
    );
  }

  async getStats() {
    const data = Array.from(this.mockData.values());
    const scores = data.map((repo: any) => repo.overall_health.score);
    const average = scores.reduce((a, b) => a + b, 0) / scores.length;

    return {
      totalRepos: data.length,
      averageHealth: Math.round(average * 100) / 100,
      healthDistribution: {
        excellent: data.filter((repo: any) => repo.overall_health.score >= 90)
          .length,
        good: data.filter(
          (repo: any) =>
            repo.overall_health.score >= 70 && repo.overall_health.score < 90,
        ).length,
        fair: data.filter(
          (repo: any) =>
            repo.overall_health.score >= 50 && repo.overall_health.score < 70,
        ).length,
        poor: data.filter((repo: any) => repo.overall_health.score < 50).length,
      },
    };
  }
}

describe('RepoHealthService Functional', () => {
  let service: RepoHealthService;
  let repositoryDataService: RepositoryDataService;

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
      ],
    }).compile();

    service = module.get<RepoHealthService>(RepoHealthService);
    repositoryDataService = module.get<RepositoryDataService>(
      RepositoryDataService,
    );
  });

  describe('Complete Repository Analysis Lifecycle', () => {
    it('should perform end-to-end analysis and storage with all schema fields', async () => {
      // Execute
      const result = await service.analyzePublicRepository('facebook', 'react');

      // Assert - Verify all schema fields are populated
      expect(result).toMatchObject({
        repo_id: 'facebook/react',
        owner: 'facebook',
        repo: 'react',
        name: 'react',
        stars: expect.any(Number),
        forks: expect.any(Number),
        open_issues: expect.any(Number),
        last_pushed: expect.any(Date),
        commit_activity: expect.any(Array),
        security_alerts: expect.any(Number),
        dependency_health: expect.any(Number),
        risky_dependencies: expect.any(Array),
        overall_health: {
          score: expect.any(Number),
          metrics: expect.any(Object),
        },
        bundle_size: 2048,
        license_risks: expect.any(Array),
        popularity: expect.any(Number),
        days_behind: expect.any(Number),
        createdAt: expect.any(Date),
        updatedAt: expect.any(Date),
      });

      // Verify the record can be retrieved
      const retrieved = await service.findRepoHealth('facebook', 'react');
      expect(retrieved.repo_id).toBe('facebook/react');
      expect(retrieved.overall_health.score).toBeGreaterThan(0);
    });

    it('should handle repositories with security vulnerabilities', async () => {
      // Execute
      const result = await service.analyzePublicRepository(
        'owner',
        'vulnerable-repo',
      );

      // Assert
      expect(result.security_alerts).toBeGreaterThan(0);
      expect((result.overall_health as any).metrics.security).toBeLessThan(100);
    });

    it('should handle dependency analysis with risky packages', async () => {
      // Setup
      const mockFile = {
        buffer: Buffer.from(
          JSON.stringify({
            dependencies: {
              'vulnerable-package': '^1.0.0',
              'outdated-lib': '^2.0.0',
            },
          }),
        ),
      } as Express.Multer.File;

      // Execute
      const result = await service.analyzePublicRepository(
        'owner',
        'repo',
        mockFile,
      );

      // Assert
      expect(result.risky_dependencies).toContain('vulnerable-pkg@1.0.0');
      expect(result.dependency_health).toBe(75);
      expect(result.license_risks).toContain('GPL-3.0');
    });
  });

  describe('Data Persistence and Retrieval', () => {
    it('should maintain data consistency across operations', async () => {
      // First analysis
      const analysisResult = await service.analyzePublicRepository(
        'microsoft',
        'vscode',
      );

      // Retrieve via different methods
      const byId = await service.findOne('microsoft/vscode');
      const byOwner = await service.findByOwner('microsoft');
      const allRepos = await service.findAll();
      // Assert consistency
      expect(byId?.repo_id).toBe('microsoft/vscode');
      expect(byOwner?.[0]?.repo_id).toBe('microsoft/vscode');
      expect(allRepos?.data?.[0]?.repo_id).toBe('microsoft/vscode');
    });

    it('should provide accurate statistics', async () => {
      // Analyze multiple repositories
      await service.analyzePublicRepository('owner1', 'repo1');
      await service.analyzePublicRepository('owner2', 'repo2');
      await service.analyzePublicRepository('owner3', 'repo3');

      // Get stats
      const stats = await service.getStats();

      // Assert
      expect(stats.totalRepos).toBe(3);
      expect(stats.averageHealth).toBeGreaterThan(0);
      expect(stats.healthDistribution).toMatchObject({
        excellent: expect.any(Number),
        good: expect.any(Number),
        fair: expect.any(Number),
        poor: expect.any(Number),
      });
    });
  });

  describe('URL-based Analysis', () => {
    const testCases = [
      {
        url: 'https://github.com/facebook/react',
        expectedOwner: 'facebook',
        expectedRepo: 'react',
      },
      {
        url: 'https://github.com/microsoft/vscode.git',
        expectedOwner: 'microsoft',
        expectedRepo: 'vscode',
      },
      {
        url: 'git@github.com:nestjs/nest.git',
        expectedOwner: 'nestjs',
        expectedRepo: 'nest',
      },
    ];

    testCases.forEach(({ url, expectedOwner, expectedRepo }) => {
      it(`should correctly analyze repository from URL: ${url}`, async () => {
        const result = await service.analyzePublicRepoByUrl(url);

        expect(result.owner).toBe(expectedOwner);
        expect(result.repo).toBe(expectedRepo);
        expect(result.repo_id).toBe(`${expectedOwner}/${expectedRepo}`);
      });
    });
  });

  describe('Batch Processing', () => {
    it('should efficiently process multiple repositories with concurrency control', async () => {
      const requests = [
        { url: 'https://github.com/facebook/react' },
        { url: 'https://github.com/vuejs/vue' },
        { url: 'https://github.com/angular/angular' },
        { url: 'https://github.com/emberjs/ember.js' },
      ];

      const startTime = Date.now();
      const results = await service.analyzeMultipleRepositories(requests, 2);
      const duration = Date.now() - startTime;

      // Assert all were processed
      expect(results).toHaveLength(4);
      expect(results.every((r) => r.data !== undefined)).toBe(true);

      // Verify concurrency worked (should take less than sequential processing)
      expect(duration).toBeLessThan(6000); // 2 concurrent batches with delay
    }, 10000);
  });
});
