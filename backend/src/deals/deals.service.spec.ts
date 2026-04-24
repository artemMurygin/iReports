import { Test, TestingModule } from '@nestjs/testing';
import { DealsService } from './deals.service';

describe('DealsService', () => {
  let service: DealsService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [DealsService],
    }).compile();

    service = module.get<DealsService>(DealsService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
