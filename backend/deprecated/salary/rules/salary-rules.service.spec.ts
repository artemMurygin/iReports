import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { SalaryRulesService } from './salary-rules.service';
import { DatabaseService } from '../../database/database.service';

describe('SalaryRulesService', () => {
  let service: SalaryRulesService;
  const db = {
    salaryRule: {
      findMany: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      findUnique: jest.fn(),
    },
    bitrixEmployee: { findUnique: jest.fn() },
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SalaryRulesService,
        { provide: DatabaseService, useValue: db },
      ],
    }).compile();
    service = module.get<SalaryRulesService>(SalaryRulesService);
  });

  it('фильтрует по назначению сотруднику ИЛИ его отделу', async () => {
    db.bitrixEmployee.findUnique.mockResolvedValue({ id: 5, departmentId: 7 });
    db.salaryRule.findMany.mockResolvedValue([]);

    await service.findAll({ employeeId: 5 });

    expect(db.salaryRule.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          assignments: {
            some: { OR: [{ employeeId: 5 }, { departmentId: 7 }] },
          },
        },
      }),
    );
  });

  it('бросает NotFoundException, если сотрудник для фильтра не найден', async () => {
    db.bitrixEmployee.findUnique.mockResolvedValue(null);
    await expect(service.findAll({ employeeId: 999 })).rejects.toThrow(
      NotFoundException,
    );
  });

  it('строит фильтр по периоду через validFrom/validTo (effective-dating)', async () => {
    db.salaryRule.findMany.mockResolvedValue([]);
    await service.findAll({ period: '2026-06' });

    expect(db.salaryRule.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          validFrom: { lt: new Date(Date.UTC(2026, 6, 1)) },
          OR: [
            { validTo: null },
            { validTo: { gte: new Date(Date.UTC(2026, 5, 1)) } },
          ],
        },
      }),
    );
  });

  it('archive переводит правило в статус ARCHIVED', async () => {
    db.salaryRule.findUnique.mockResolvedValue({ id: 1 });
    db.salaryRule.update.mockResolvedValue({ id: 1, status: 'ARCHIVED' });

    const result = await service.archive(1);

    expect(db.salaryRule.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 1 },
        data: { status: 'ARCHIVED' },
      }),
    );
    expect(result.status).toBe('ARCHIVED');
  });

  it('archive бросает NotFoundException для несуществующего правила', async () => {
    db.salaryRule.findUnique.mockResolvedValue(null);
    await expect(service.archive(404)).rejects.toThrow(NotFoundException);
  });
});
