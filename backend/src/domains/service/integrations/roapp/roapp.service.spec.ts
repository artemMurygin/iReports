import { Test, TestingModule } from '@nestjs/testing';
import { RoappService } from './roapp.service';

describe('RoappService', () => {
  let service: RoappService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [RoappService],
    }).compile();

    service = module.get<RoappService>(RoappService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
