import { Test, TestingModule } from '@nestjs/testing';
import { RepositoryDetailsController } from './repository-details.controller';

describe('RepositoryDetailsController', () => {
  let controller: RepositoryDetailsController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [RepositoryDetailsController],
    }).compile();

    controller = module.get<RepositoryDetailsController>(
      RepositoryDetailsController,
    );
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
