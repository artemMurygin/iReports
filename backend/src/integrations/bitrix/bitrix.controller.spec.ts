import { Test, TestingModule } from '@nestjs/testing';
import { BitrixController } from './bitrix.controller';
import { BitrixService } from './bitrix.service';

describe('BitrixController', () => {
  let controller: BitrixController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [BitrixController],
      providers: [BitrixService],
    }).compile();

    controller = module.get<BitrixController>(BitrixController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
