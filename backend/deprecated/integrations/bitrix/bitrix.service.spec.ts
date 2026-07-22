import { Test, TestingModule } from '@nestjs/testing';
import { BitrixService } from './bitrix.service';

describe('BitrixService', () => {
  let service: BitrixService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [BitrixService],
    }).compile();

    service = module.get<BitrixService>(BitrixService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
