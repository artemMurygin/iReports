import { Test, TestingModule } from '@nestjs/testing';
import { CategoriesController } from './categories.controller';
import { CategoriesService } from './categories.service';
import { Direction } from '../../../prisma/generated/prisma/schema/client';

describe('CategoriesController', () => {
  let controller: CategoriesController;
  const categoriesService = { getCategories: jest.fn() };

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      controllers: [CategoriesController],
      providers: [{ provide: CategoriesService, useValue: categoriesService }],
    }).compile();

    controller = module.get<CategoriesController>(CategoriesController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  it('delegates to CategoriesService with the requested direction', async () => {
    categoriesService.getCategories.mockResolvedValue([]);

    await controller.getCategories({ direction: Direction.SHOP });

    expect(categoriesService.getCategories).toHaveBeenCalledWith(
      Direction.SHOP,
    );
  });
});
