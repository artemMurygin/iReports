import { Test, TestingModule } from '@nestjs/testing';
import { PlanFactService } from './plan-fact.service';
import { DatabaseService } from '../../database/database.service';

const PERIOD = '2026-06';

function createDb() {
  return {
    planTarget: { findMany: jest.fn() },
    bitrixEmployee: { findUnique: jest.fn(), findMany: jest.fn() },
    roappServiceCategory: { findMany: jest.fn().mockResolvedValue([]) },
    moySkladProductFolder: { findMany: jest.fn().mockResolvedValue([]) },
    roappServiceOrder: { findMany: jest.fn().mockResolvedValue([]) },
    moySkladDemandPosition: { findMany: jest.fn().mockResolvedValue([]) },
  };
}

async function buildService(db: ReturnType<typeof createDb>) {
  const module: TestingModule = await Test.createTestingModule({
    providers: [PlanFactService, { provide: DatabaseService, useValue: db }],
  }).compile();
  return module.get<PlanFactService>(PlanFactService);
}

describe('PlanFactService', () => {
  it('PERSONAL: считает факт только по одному сотруднику (через roappId)', async () => {
    const db = createDb();
    db.planTarget.findMany.mockResolvedValue([
      {
        id: 1,
        direction: 'SERVICE',
        scope: 'PERSONAL',
        employeeId: 5,
        departmentId: null,
        categoryExtId: null,
        stat: 'REVENUE',
        planValue: 1000,
      },
    ]);
    db.bitrixEmployee.findUnique.mockResolvedValue({ roappId: 100 });
    let capturedWhere: { engineerId?: unknown } = {};
    db.roappServiceOrder.findMany.mockImplementation(
      (args: { where: { engineerId?: unknown } }) => {
        capturedWhere = args.where;
        return Promise.resolve([
          {
            price: 500,
            quantity: 1,
            discount: 0,
            cost: 100,
            engeneerSalary: 0,
          },
        ]);
      },
    );

    const service = await buildService(db);
    const [row] = await service.getTable({
      period: PERIOD,
      scope: 'PERSONAL' as never,
    });

    expect(capturedWhere.engineerId).toEqual({ in: [100] });
    expect(row.factValue).toBe(500);
  });

  it('PERSONAL: возвращает 0 без запроса заказов, если у сотрудника нет roappId', async () => {
    const db = createDb();
    db.planTarget.findMany.mockResolvedValue([
      {
        id: 1,
        direction: 'SERVICE',
        scope: 'PERSONAL',
        employeeId: 5,
        departmentId: null,
        categoryExtId: null,
        stat: 'REVENUE',
        planValue: 1000,
      },
    ]);
    db.bitrixEmployee.findUnique.mockResolvedValue({ roappId: null });

    const service = await buildService(db);
    const [row] = await service.getTable({
      period: PERIOD,
      scope: 'PERSONAL' as never,
    });

    expect(db.roappServiceOrder.findMany).not.toHaveBeenCalled();
    expect(row.factValue).toBe(0);
  });

  it('DEPARTMENT: агрегирует по всем сотрудникам отдела (moySkladId)', async () => {
    const db = createDb();
    db.planTarget.findMany.mockResolvedValue([
      {
        id: 2,
        direction: 'SHOP',
        scope: 'DEPARTMENT',
        employeeId: null,
        departmentId: 7,
        categoryExtId: null,
        stat: 'REVENUE',
        planValue: 5000,
      },
    ]);
    db.bitrixEmployee.findMany.mockResolvedValue([
      { moySkladId: 'a' },
      { moySkladId: 'b' },
      { moySkladId: null },
    ]);
    let capturedOr: unknown;
    db.moySkladDemandPosition.findMany.mockImplementation(
      (args: { where: { demand: { OR: unknown } } }) => {
        capturedOr = args.where.demand.OR;
        return Promise.resolve([
          { sum: 1000, cost: 0, profit: 0, quantity: 1 },
          { sum: 2000, cost: 0, profit: 0, quantity: 1 },
        ]);
      },
    );

    const service = await buildService(db);
    const [row] = await service.getTable({
      period: PERIOD,
      scope: 'DEPARTMENT' as never,
    });

    expect(capturedOr).toEqual([
      { onlineManagerId: { in: ['a', 'b'] } },
      { offlineManagerId: { in: ['a', 'b'] } },
    ]);
    expect(row.factValue).toBe(3000);
  });

  it('COMPANY: не фильтрует по сотруднику вовсе', async () => {
    const db = createDb();
    db.planTarget.findMany.mockResolvedValue([
      {
        id: 3,
        direction: 'SERVICE',
        scope: 'COMPANY',
        employeeId: null,
        departmentId: null,
        categoryExtId: null,
        stat: 'PCS',
        planValue: 100,
      },
    ]);
    let capturedWhere: { engineerId?: unknown } = {};
    db.roappServiceOrder.findMany.mockImplementation(
      (args: { where: { engineerId?: unknown } }) => {
        capturedWhere = args.where;
        return Promise.resolve([
          { price: 0, quantity: 3, discount: 0, cost: 0, engeneerSalary: 0 },
        ]);
      },
    );

    const service = await buildService(db);
    const [row] = await service.getTable({
      period: PERIOD,
      scope: 'COMPANY' as never,
    });

    expect(capturedWhere.engineerId).toBeUndefined();
    expect(db.bitrixEmployee.findUnique).not.toHaveBeenCalled();
    expect(db.bitrixEmployee.findMany).not.toHaveBeenCalled();
    expect(row.factValue).toBe(3);
  });
});
