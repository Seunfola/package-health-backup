import { Test, TestingModule } from '@nestjs/testing';
import { RepoHealthController } from './repo-health.controller';

describe('RepoHealthController', () => {
  let controller: RepoHealthController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [RepoHealthController],
    }).compile();

    controller = module.get<RepoHealthController>(RepoHealthController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
