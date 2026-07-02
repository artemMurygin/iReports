import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { GoalsService } from './goals.service';
import { DatabaseService } from '../../database/database.service';

describe('GoalsService', () => {
  let service: GoalsService;
  const db = {
    goal: { create: jest.fn(), update: jest.fn(), findUnique: jest.fn() },
    roappServiceCategory: { findUnique: jest.fn() },
    moySkladProductFolder: { findUnique: jest.fn() },
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      providers: [GoalsService, { provide: DatabaseService, useValue: db }],
    }).compile();
    service = module.get<GoalsService>(GoalsService);
  });

  const baseDto = {
    ruleId: 1,
    type: 'KPI' as const,
    direction: 'SERVICE' as const,
    scope: 'PERSONAL' as const,
    name: 'План по выручке',
    sortOrder: 0,
    managerRole: 'OFFLINE' as const,
    rewardId: 1,
  };

  it('создаёт цель без категории без обращения к источникам категорий', async () => {
    db.goal.create.mockResolvedValue({ id: 1 });
    await service.create(baseDto);
    expect(db.roappServiceCategory.findUnique).not.toHaveBeenCalled();
    expect(db.goal.create).toHaveBeenCalled();
  });

  it('SERVICE: кастует categoryExtId в int и проверяет существование в roapp_service_categories', async () => {
    db.roappServiceCategory.findUnique.mockResolvedValue({ id: 909016 });
    db.goal.create.mockResolvedValue({ id: 1 });

    await service.create({ ...baseDto, categoryExtId: '909016' });

    expect(db.roappServiceCategory.findUnique).toHaveBeenCalledWith({
      where: { id: 909016 },
    });
  });

  it('SERVICE: 400, если categoryExtId не парсится в число', async () => {
    await expect(
      service.create({ ...baseDto, categoryExtId: 'not-a-number' }),
    ).rejects.toThrow(BadRequestException);
    expect(db.goal.create).not.toHaveBeenCalled();
  });

  it('400, если категория не найдена в источнике', async () => {
    db.roappServiceCategory.findUnique.mockResolvedValue(null);
    await expect(
      service.create({ ...baseDto, categoryExtId: '999' }),
    ).rejects.toThrow(BadRequestException);
    expect(db.goal.create).not.toHaveBeenCalled();
  });

  it('SHOP: категорию использует как строку в moy_sklad_product_folders', async () => {
    db.moySkladProductFolder.findUnique.mockResolvedValue({ id: 'f1' });
    db.goal.create.mockResolvedValue({ id: 2 });

    await service.create({
      ...baseDto,
      direction: 'SHOP',
      categoryExtId: 'f1',
    });

    expect(db.moySkladProductFolder.findUnique).toHaveBeenCalledWith({
      where: { id: 'f1' },
    });
  });

  it('update: 404 для несуществующей цели', async () => {
    db.goal.findUnique.mockResolvedValue(null);
    await expect(service.update(404, { name: 'x' })).rejects.toThrow(
      NotFoundException,
    );
  });

  it('update: переиспользует direction существующей цели для валидации категории', async () => {
    db.goal.findUnique.mockResolvedValue({ id: 1, direction: 'SHOP' });
    db.moySkladProductFolder.findUnique.mockResolvedValue({ id: 'f2' });
    db.goal.update.mockResolvedValue({ id: 1 });

    await service.update(1, { categoryExtId: 'f2' });

    expect(db.moySkladProductFolder.findUnique).toHaveBeenCalledWith({
      where: { id: 'f2' },
    });
  });
});
