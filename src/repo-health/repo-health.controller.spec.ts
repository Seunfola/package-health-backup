import { Test, TestingModule } from '@nestjs/testing';
import { RepoHealthController } from './repo-health.controller';
import { RepoHealthService } from './services/repo-health.service';

describe('RepoHealthController', () => {
  let controller: RepoHealthController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [RepoHealthController],
      providers: [
        {
          provide: RepoHealthService,
          useValue: {
            analyzePublicRepoByUrl: jest.fn().mockResolvedValue({}),
            analyzePrivateRepoByUrl: jest.fn().mockResolvedValue({}),
          },
        },
      ],
    }).compile();

    controller = module.get<RepoHealthController>(RepoHealthController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
