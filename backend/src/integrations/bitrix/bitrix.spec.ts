import { Test, TestingModule } from '@nestjs/testing';
import { Bitrix } from './bitrix';

describe('Bitrix', () => {
  let provider: Bitrix;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [Bitrix],
    }).compile();

    provider = module.get<Bitrix>(Bitrix);
  });

  it('should be defined', () => {
    expect(provider).toBeDefined();
  });
});
