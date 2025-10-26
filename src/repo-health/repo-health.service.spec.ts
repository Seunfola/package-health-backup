import { Test, TestingModule } from '@nestjs/testing';
import { RepoHealthService } from './repo-health.service';

describe('RepoHealthService', () => {
  let service: RepoHealthService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [RepoHealthService],
    }).compile();

    service = module.get<RepoHealthService>(RepoHealthService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
