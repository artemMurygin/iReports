import { Test, TestingModule } from '@nestjs/testing';
import { BitrixSyncService } from './bitrix.service';

describe('BitrixSyncService', () => {
  let service: BitrixSyncService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [BitrixSyncService],
    }).compile();

    service = module.get<BitrixSyncService>(BitrixSyncService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
