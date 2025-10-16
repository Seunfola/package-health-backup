import { Test, TestingModule } from '@nestjs/testing';
import { RepositoryDetailsService } from './repository-details.service';

describe('RepositoryDetailsService', () => {
  let service: RepositoryDetailsService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [RepositoryDetailsService],
    }).compile();

    service = module.get<RepositoryDetailsService>(RepositoryDetailsService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
