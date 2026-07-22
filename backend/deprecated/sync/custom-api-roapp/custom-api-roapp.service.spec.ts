import { Test, TestingModule } from '@nestjs/testing';
import { CustomApiRoappService } from './custom-api-roapp.service';

describe('CustomApiRoappService', () => {
  let service: CustomApiRoappService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [CustomApiRoappService],
    }).compile();

    service = module.get<CustomApiRoappService>(CustomApiRoappService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
