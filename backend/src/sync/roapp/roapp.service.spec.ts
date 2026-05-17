import { Test, TestingModule } from '@nestjs/testing';
import { RoappSyncService } from './roapp.service';

describe('RoappSyncService', () => {
  let service: RoappSyncService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [RoappSyncService],
    }).compile();

    service = module.get<RoappSyncService>(RoappSyncService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
