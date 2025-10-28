import { Test, TestingModule } from '@nestjs/testing';
import { getModelToken } from '@nestjs/mongoose';
import { RepoHealth } from '../repo-health.model';
import { Model } from 'mongoose';
import { RepositoryDataService } from '../services/repository-data.service';

describe('RepositoryDataService', () => {
  let service: RepositoryDataService;
  let model: jest.Mocked<Model<any>>;

  beforeEach(async () => {
    const mockRepoHealthModel = {
      findOne: jest.fn(),
      find: jest.fn(),
      countDocuments: jest.fn(),
      findOneAndUpdate: jest.fn(),
      deleteOne: jest.fn(),
      exec: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        RepositoryDataService,
        {
          provide: getModelToken(RepoHealth.name),
          useValue: mockRepoHealthModel,
        },
      ],
    }).compile();

    service = module.get<RepositoryDataService>(RepositoryDataService);
    model = module.get(getModelToken(RepoHealth.name));
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('findOne', () => {
    it('should find one repo by repo_id', async () => {
      const mockRepo = { repo_id: 'user/repo' };
      (model.findOne as any).mockReturnValue({
        exec: () => Promise.resolve(mockRepo),
      });

      const result = await service.findOne('user/repo');
      expect(model.findOne).toHaveBeenCalledWith({ repo_id: 'user/repo' });
      expect(result).toEqual(mockRepo);
    });
  });

  describe('findByOwner', () => {
    it('should return repos by owner sorted by score', async () => {
      const mockRepos = [{ owner: 'user', overall_health: { score: 90 } }];
      (model.find as any).mockReturnValue({
        sort: () => ({ exec: () => Promise.resolve(mockRepos) }),
      });

      const result = await service.findByOwner('user');
      expect(model.find).toHaveBeenCalledWith({ owner: 'user' });
      expect(result).toEqual(mockRepos);
    });
  });

  describe('findAll', () => {
    it('should return paginated repos', async () => {
      const mockData = [{ name: 'repo1' }];
      (model.find as any).mockReturnValue({
        sort: () => ({
          skip: () => ({
            limit: () => ({ exec: () => Promise.resolve(mockData) }),
          }),
        }),
      });
      (model.countDocuments as any).mockReturnValue({
        exec: () => Promise.resolve(1),
      });

      const result = await service.findAll(1, 10);
      expect(result.data).toEqual(mockData);
      expect(result.total).toBe(1);
      expect(result.totalPages).toBe(1);
    });
  });

  describe('upsertRepoHealth', () => {
    it('should upsert repo health document', async () => {
      const mockRepo = { repo_id: 'test/repo' };
      (model.findOneAndUpdate as any).mockResolvedValue(mockRepo);

      const result = await service.upsertRepoHealth('test/repo', {
        name: 'repo',
      });
      expect(model.findOneAndUpdate).toHaveBeenCalledWith(
        { repo_id: 'test/repo' },
        { name: 'repo' },
        expect.objectContaining({
          new: true,
          upsert: true,
          setDefaultsOnInsert: true,
        }),
      );
      expect(result).toEqual(mockRepo);
    });
  });

  describe('deleteRepo', () => {
    it('should return true if repo deleted', async () => {
      (model.deleteOne as any).mockReturnValue({
        exec: () => Promise.resolve({ deletedCount: 1 }),
      });
      const result = await service.deleteRepo('id');
      expect(result).toBe(true);
    });

    it('should return false if repo not deleted', async () => {
      (model.deleteOne as any).mockReturnValue({
        exec: () => Promise.resolve({ deletedCount: 0 }),
      });
      const result = await service.deleteRepo('id');
      expect(result).toBe(false);
    });
  });

  describe('getStats', () => {
    it('should return zero stats when no repos', async () => {
      (model.find as any).mockReturnValue({ exec: () => Promise.resolve([]) });

      const result = await service.getStats();
      expect(result).toEqual({
        totalRepos: 0,
        averageHealth: 0,
        healthDistribution: { excellent: 0, good: 0, moderate: 0, poor: 0 },
      });
    });

    it('should calculate stats correctly', async () => {
      const mockRepos = [
        { overall_health: { score: 85 } },
        { overall_health: { score: 70 } },
        { overall_health: { score: 55 } },
        { overall_health: { score: 30 } },
      ];
      (model.find as any).mockReturnValue({
        exec: () => Promise.resolve(mockRepos),
      });

      const result = await service.getStats();

      expect(result.totalRepos).toBe(4);
      expect(result.averageHealth).toBeCloseTo(60);
      expect(result.healthDistribution).toEqual({
        excellent: 1,
        good: 1,
        moderate: 1,
        poor: 1,
      });
    });
  });
});
