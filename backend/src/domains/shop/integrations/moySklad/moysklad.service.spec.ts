import { Test, TestingModule } from '@nestjs/testing';
import { MoyskladService } from './moysklad.service';

describe('MoyskladService', () => {
  let service: MoyskladService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [MoyskladService],
    }).compile();

    service = module.get<MoyskladService>(MoyskladService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
