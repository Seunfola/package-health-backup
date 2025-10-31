import { of } from 'rxjs';
import { RepoHealthService } from 'src/repo-health/services/repo-health.service';
import { DependencyAnalysisService } from 'src/repo-health/services/dependency-analysis.service';
import { GithubApiService } from 'src/repo-health/services/github-api.service';
import { RepoHealthDocument } from 'src/repo-health/repo-health.model';


const createMockModel = (): any => ({
  findOne: jest.fn().mockReturnValue({
    exec: jest.fn().mockResolvedValue(null),
    lean: jest.fn().mockReturnThis(),
  }),
  create: jest.fn().mockResolvedValue({
    owner: 'octocat',
    repo: 'Hello-World',
    dependency_health: 95,
    overall_health: { score: 95, label: 'Good' },
  }),
  findOneAndUpdate: jest.fn().mockReturnValue({
    exec: jest.fn().mockResolvedValue({
      owner: 'octocat',
      repo: 'Hello-World',
      dependency_health: 95,
      overall_health: { score: 95, label: 'Good' },
    }),
  }),
});


const createMockGithubApiService = (): GithubApiService => {
  return {
    // Required properties/methods
    getRepoStars: jest.fn().mockResolvedValue(5),
    getRepoOpenIssues: jest.fn().mockResolvedValue(1),
    getRepoContributors: jest.fn().mockResolvedValue([]),
    getRepoLastPushDate: jest.fn().mockResolvedValue(new Date().toISOString()),
    getPackageJson: jest.fn().mockResolvedValue({}),
    getRepoLanguages: jest.fn().mockResolvedValue({}),
    getRepo: jest.fn().mockResolvedValue({}),
    getRepoCommits: jest.fn().mockResolvedValue([]),
    getLatestRelease: jest.fn().mockResolvedValue({}),
    getRepoReadme: jest.fn().mockResolvedValue(''),
    fetchFromGithubApi: jest.fn().mockResolvedValue({}),
    determineRepoVisibility: jest.fn().mockResolvedValue('public'),

    // Optional internal helpers
    BASE_URL: 'https://api.github.com',
    CACHE_TTL: 60,
  } as unknown as GithubApiService;
};


const createMockDependencyAnalysisService = (): DependencyAnalysisService => {
  return {
    analyzeDependencies: jest.fn().mockResolvedValue({
      dependencyHealth: 95,
      riskyDependencies: [],
      bundleSize: 0,
      licenseRisks: [],
      popularity: 80,
      daysBehind: 10,
    }),
  } as unknown as DependencyAnalysisService;
};


describe('Package Health Integration', () => {
  let service: RepoHealthService;

  beforeEach(() => {
    const mockGithubApiService = createMockGithubApiService();
    const mockDependencyService = createMockDependencyAnalysisService();
    const mockModel = createMockModel();

    // Construct with correct argument order (matches RepoHealthService)
    service = new RepoHealthService(
      mockGithubApiService,
      mockDependencyService,
      {
        // Minimal mock HealthCalculatorService
        calculateOverallHealth: jest.fn().mockReturnValue({
          score: 95,
          label: 'Excellent',
        }),
      } as any,
      {
        // Minimal mock RepositoryDataService
        saveRepoData: jest.fn().mockResolvedValue({}),
      } as any,
    );
  });

  it('should analyze a GitHub repository successfully', async () => {
    const result = await service.analyzeRepositoryAuto(
      'octocat',
      'Hello-World',
    );

    expect(result).toHaveProperty('owner', 'octocat');
    expect(result).toHaveProperty('repo', 'Hello-World');
    expect(result).toHaveProperty('overall_health');
    expect(result.dependency_health).toBe(95);
  });

  it('should handle errors gracefully', async () => {
    const mockGithubApiService = createMockGithubApiService();
    // Make sure getRepoStars exists as a jest function (fix type issue)
    (mockGithubApiService as any).getRepoStars = jest.fn().mockRejectedValueOnce(
      new Error('Network error'),
    );

    // Recreate service with failing GitHub mock
    service = new RepoHealthService(
      mockGithubApiService,
      createMockDependencyAnalysisService(),
      { calculateOverallHealth: jest.fn() } as any,
      { saveRepoData: jest.fn() } as any,
    );

    await expect(
      service.analyzeRepositoryAuto('octocat', 'Hello-World'),
    ).rejects.toThrow('Network error');
  });
});
