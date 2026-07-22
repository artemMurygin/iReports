import { Test, TestingModule } from '@nestjs/testing';
import { BitrixHttpService } from './bitrix.instance';

describe('Bitrix', () => {
  let provider: BitrixHttpService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [BitrixHttpService],
    }).compile();

    provider = module.get<BitrixHttpService>(BitrixHttpService);
  });

  it('should be defined', () => {
    expect(provider).toBeDefined();
  });
});
