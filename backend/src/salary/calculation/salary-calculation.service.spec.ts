import { Test, TestingModule } from '@nestjs/testing';
import { SalaryCalculationService } from './salary-calculation.service';
import { DatabaseService } from '../../database/database.service';

// Период выбран заведомо в прошлом (относительно любого будущего запуска тестов),
// чтобы elapsedShare всегда был равен 1 (месяц полностью отработан) — это делает
// прогнозные и фактические величины равными и легко проверяемыми вручную.
const PERIOD = '2026-06';
const EMPLOYEE_ID = 1;

type FakeReport = {
  id: number;
  employeeId: number;
  period: string;
  status: string;
  factTotal: number;
  projected: number;
  closedAt: Date | null;
};
type FakeLineItem = Record<string, unknown> & { id: number; reportId: number };

// Мини-хранилище в памяти для salary_reports/salary_line_items — единственных таблиц,
// которые пайплайн реально создаёт/обновляет; остальные вызовы БД — read-only фикстуры.
function createFakeReportStore() {
  const reports = new Map<string, FakeReport>();
  const lineItemsByReport = new Map<number, FakeLineItem[]>();
  let nextReportId = 1;
  let nextLineItemId = 1;

  const salaryReport = {
    findUnique: jest.fn(
      ({
        where: { employeeId_period },
      }: {
        where: { employeeId_period: { employeeId: number; period: string } };
      }) => {
        const key = `${employeeId_period.employeeId}:${employeeId_period.period}`;
        const report = reports.get(key);
        if (!report) return null;
        return { ...report, lineItems: lineItemsByReport.get(report.id) ?? [] };
      },
    ),
    upsert: jest.fn(
      ({
        where: { employeeId_period },
        create,
        update,
      }: {
        where: { employeeId_period: { employeeId: number; period: string } };
        create: Omit<FakeReport, 'id'>;
        update: Partial<FakeReport>;
      }) => {
        const key = `${employeeId_period.employeeId}:${employeeId_period.period}`;
        const existing = reports.get(key);
        const report: FakeReport = existing
          ? { ...existing, ...update }
          : { id: nextReportId++, ...create };
        reports.set(key, report);
        return report;
      },
    ),
    findUniqueOrThrow: jest.fn(
      ({ where: { id } }: { where: { id: number } }) => {
        const report = [...reports.values()].find((r) => r.id === id)!;
        return { ...report, lineItems: lineItemsByReport.get(id) ?? [] };
      },
    ),
  };

  const salaryLineItem = {
    deleteMany: jest.fn(
      ({ where: { reportId } }: { where: { reportId: number } }) => {
        lineItemsByReport.delete(reportId);
        return { count: 0 };
      },
    ),
    createMany: jest.fn(({ data }: { data: FakeLineItem[] }) => {
      for (const item of data) {
        const list = lineItemsByReport.get(item.reportId) ?? [];
        list.push({ ...item, id: nextLineItemId++ });
        lineItemsByReport.set(item.reportId, list);
      }
      return { count: data.length };
    }),
  };

  return { salaryReport, salaryLineItem };
}

const BASE_EMPLOYEE = {
  id: EMPLOYEE_ID,
  departmentId: 10,
  roappId: 100,
  moySkladId: 'ms-1',
};

function createDb(fixtures: {
  rules: unknown[];
  shifts?: unknown[];
  planTargetImpl?: (args: {
    where: { direction: string };
  }) => Promise<{ planValue: number } | null>;
  serviceOrders?: unknown[];
  shopPositions?: unknown[];
  adjustments?: unknown[];
}) {
  const store = createFakeReportStore();
  const db = {
    bitrixEmployee: {
      findUnique: jest.fn().mockResolvedValue(BASE_EMPLOYEE),
    },
    salaryRule: { findMany: jest.fn().mockResolvedValue(fixtures.rules) },
    workShift: { findMany: jest.fn().mockResolvedValue(fixtures.shifts ?? []) },
    salaryAdjustment: {
      findMany: jest.fn().mockResolvedValue(fixtures.adjustments ?? []),
    },
    taskCompletion: { findUnique: jest.fn().mockResolvedValue(null) },
    planTarget: {
      findFirst: jest.fn(
        fixtures.planTargetImpl ?? (() => Promise.resolve(null)),
      ),
    },
    roappServiceOrder: {
      findMany: jest.fn().mockResolvedValue(fixtures.serviceOrders ?? []),
    },
    moySkladDemandPosition: {
      findMany: jest.fn().mockResolvedValue(fixtures.shopPositions ?? []),
    },
    roappServiceCategory: { findMany: jest.fn().mockResolvedValue([]) },
    moySkladProductFolder: { findMany: jest.fn().mockResolvedValue([]) },
    ...store,
  };
  return {
    ...db,
    $transaction: jest.fn((cb: (tx: typeof db) => unknown) => cb(db)),
  };
}

async function buildService(db: ReturnType<typeof createDb>) {
  const module: TestingModule = await Test.createTestingModule({
    providers: [
      SalaryCalculationService,
      { provide: DatabaseService, useValue: db as unknown as DatabaseService },
    ],
  }).compile();
  return module.get(SalaryCalculationService);
}

// Плоский тир прогрессии (coef=1 всегда) — арифметика теста проверяет пайплайн
// начислений, а не саму progressionCoef (она покрыта отдельными юнит-тестами).
const flatTier = {
  fromPct: 0,
  toPct: null,
  mode: 'FIXED',
  coef: 1,
  coefFrom: null,
  coefTo: null,
};

const serviceGoal = {
  id: 10,
  type: 'KPI',
  direction: 'SERVICE',
  scope: 'PERSONAL',
  sortOrder: 0,
  kpiDirection: 'SALES',
  measureStat: 'REVENUE',
  categoryExtId: null,
  rewardId: 20,
  reward: {
    name: '% маржи за вычетом ЗП мастера',
    type: 'PERCENT',
    value: 1000, // 10.00%
    baseStat: 'MARGIN_MINUS_ENGINEER',
    minAmount: null,
    maxAmount: null,
    tiers: [flatTier],
  },
};

const shopGoal = {
  id: 11,
  type: 'KPI',
  direction: 'SHOP',
  scope: 'PERSONAL',
  sortOrder: 0,
  kpiDirection: 'SALES',
  measureStat: 'REVENUE',
  categoryExtId: null,
  rewardId: 21,
  reward: {
    name: 'Бонус за выполнение плана магазина',
    type: 'FIX',
    value: 500,
    baseStat: null,
    minAmount: null,
    maxAmount: null,
    tiers: [{ ...flatTier, mode: 'MULTIPLIER' }],
  },
};

describe('SalaryCalculationService (интеграционный пайплайн /salaryReport)', () => {
  it('считает почасовую часть + KPI(SERVICE) + KPI(SHOP) + штраф в корректные factTotal/projected с расшифровкой', async () => {
    const db = createDb({
      rules: [
        {
          id: 1,
          name: 'Базовое правило',
          payPerHour: 200,
          goals: [serviceGoal, shopGoal],
        },
      ],
      shifts: [
        { date: new Date('2026-06-01'), plannedHours: 80, actualHours: 75 },
        { date: new Date('2026-06-15'), plannedHours: 80, actualHours: 75 },
      ],
      planTargetImpl: ({ where }) =>
        Promise.resolve(
          where.direction === 'SERVICE'
            ? { planValue: 1000 }
            : { planValue: 2000 },
        ),
      serviceOrders: [
        {
          orderId: 555,
          price: 1000,
          quantity: 1,
          discount: 0,
          cost: 200,
          engeneerSalary: 50,
        },
      ],
      shopPositions: [
        { demandId: 'd-1', sum: 2000, cost: 800, profit: 1200, quantity: 1 },
      ],
      adjustments: [
        { id: 99, accrualType: 'PENALTY', amount: -300, reason: 'Опоздание' },
      ],
    });

    const service = await buildService(db);
    const report = await service.getReport(EMPLOYEE_ID, PERIOD);

    // Почасовая: 200×75×2=30000 факт, 200×80×2=32000 прогноз.
    // Сервис: revenue=1000=план → factPct=100%; margin-engineer=750; 10% → 75 (факт=прогноз).
    // Магазин: revenue=2000=план → factPct=100%; фикс-бонус 500 (факт=прогноз).
    // Штраф: -300.
    expect(report.factTotal).toBe(30000 + 75 + 500 - 300);
    expect(report.projected).toBe(32000 + 75 + 500 - 300);
    expect(report.status).toBe('PROJECTED');
    expect(report.lineItems.length).toBeGreaterThan(0);

    const hourly = report.lineItems.find((l) => l.accrualType === 'HOURLY');
    expect(hourly).toMatchObject({ factAmount: 30000, projected: 32000 });

    const serviceLine = report.lineItems.find(
      (l) => l.goalId === serviceGoal.id && l.sourceType === 'roapp_order',
    );
    expect(serviceLine).toBeDefined();
    expect(serviceLine).toMatchObject({
      factAmount: 75,
      projected: 75,
      sourceId: '555',
    });
    expect(serviceLine?.meta).toMatchObject({ factPct: 100, base: 750 });

    const shopLine = report.lineItems.find(
      (l) => l.goalId === shopGoal.id && l.sourceType === null,
    );
    expect(shopLine).toBeDefined();
    expect(shopLine).toMatchObject({ factAmount: 500, projected: 500 });

    const penaltyLine = report.lineItems.find(
      (l) => l.accrualType === 'PENALTY',
    );
    expect(penaltyLine).toBeDefined();
    expect(penaltyLine).toMatchObject({
      factAmount: -300,
      projected: -300,
      label: 'Опоздание',
    });
  });

  it('ветка TURNOVER возвращает NO_DATA, не начисляет и не ломает отчёт', async () => {
    const turnoverGoal = {
      id: 12,
      type: 'KPI',
      direction: 'SHOP',
      scope: 'PERSONAL',
      sortOrder: 0,
      kpiDirection: 'TURNOVER',
      measureStat: 'REVENUE',
      categoryExtId: null,
      rewardId: 22,
      reward: {
        name: 'Оборачиваемость',
        type: 'FIX',
        value: 1000,
        baseStat: null,
        minAmount: null,
        maxAmount: null,
        tiers: [flatTier],
      },
    };
    const db = createDb({
      rules: [
        { id: 2, name: 'Закупки', payPerHour: null, goals: [turnoverGoal] },
      ],
    });

    const service = await buildService(db);
    const report = await service.getReport(EMPLOYEE_ID, PERIOD);

    expect(report.factTotal).toBe(0);
    expect(report.projected).toBe(0);
    const line = report.lineItems.find((l) => l.goalId === turnoverGoal.id);
    expect(line).toBeDefined();
    expect(line?.meta).toMatchObject({ status: 'NO_DATA' });
  });

  it('правка правил не меняет расчёт уже закрытого месяца', async () => {
    const rulesMock = jest
      .fn()
      .mockResolvedValue([
        { id: 1, name: 'Базовое', payPerHour: 100, goals: [] },
      ]);
    const db = createDb({
      rules: [],
      shifts: [
        { date: new Date('2026-06-01'), plannedHours: 10, actualHours: 10 },
      ],
    });
    db.salaryRule.findMany = rulesMock;

    const service = await buildService(db);

    const closed = await service.closeReport(EMPLOYEE_ID, PERIOD);
    expect(closed.status).toBe('CLOSED');
    expect(closed.factTotal).toBe(1000);

    // Меняем правило "задним числом" — новый прогон GET не должен пересчитать закрытый отчёт.
    rulesMock.mockResolvedValue([
      { id: 1, name: 'Базовое (изменено)', payPerHour: 999999, goals: [] },
    ]);

    const reFetched = await service.getReport(EMPLOYEE_ID, PERIOD);
    expect(reFetched.factTotal).toBe(1000);
    expect(reFetched.status).toBe('CLOSED');
  });

  it('бросает NotFoundException, если сотрудник не найден в bitrix_employees', async () => {
    const db = createDb({ rules: [] });
    db.bitrixEmployee.findUnique = jest.fn().mockResolvedValue(null);
    const service = await buildService(db);

    await expect(service.getReport(999999, PERIOD)).rejects.toThrow(
      'не найден',
    );
  });
});
