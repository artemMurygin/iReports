import { Test, TestingModule } from '@nestjs/testing';
import { CategoriesService } from './categories.service';
import { DatabaseService } from '../../database/database.service';
import { Direction } from '../../../prisma/generated/prisma/schema/client';

describe('CategoriesService', () => {
  let service: CategoriesService;
  const db = {
    roappServiceCategory: { findMany: jest.fn() },
    moySkladProductFolder: { findMany: jest.fn() },
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CategoriesService,
        { provide: DatabaseService, useValue: db },
      ],
    }).compile();

    service = module.get<CategoriesService>(CategoriesService);
  });

  it('reads roapp_service_categories for SERVICE', async () => {
    db.roappServiceCategory.findMany.mockResolvedValue([
      { id: 1, name: 'Ремонт', parentId: null, depth: 0 },
    ]);

    const result = await service.getCategories(Direction.SERVICE);

    expect(db.roappServiceCategory.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        select: { id: true, name: true, parentId: true, depth: true },
      }),
    );
    expect(db.moySkladProductFolder.findMany).not.toHaveBeenCalled();
    expect(result).toEqual([
      { id: 1, name: 'Ремонт', parentId: null, depth: 0 },
    ]);
  });

  it('reads moy_sklad_product_folders for SHOP', async () => {
    db.moySkladProductFolder.findMany.mockResolvedValue([
      { id: 'f1', name: 'Аксессуары', parentId: null, pathName: 'Аксессуары' },
    ]);

    const result = await service.getCategories(Direction.SHOP);

    expect(db.moySkladProductFolder.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { archived: false } }),
    );
    expect(db.roappServiceCategory.findMany).not.toHaveBeenCalled();
    expect(result).toEqual([
      { id: 'f1', name: 'Аксессуары', parentId: null, pathName: 'Аксессуары' },
    ]);
  });
});
