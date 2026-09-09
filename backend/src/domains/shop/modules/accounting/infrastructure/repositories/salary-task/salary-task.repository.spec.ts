import { ShopSalaryTaskRepository } from './salary-task.repository';
import { ShopSalaryTask } from '@/domains/shop/modules/accounting/domain/entities/salary-task/salary-task.entity';
import { ShopTaskStatus } from '@/domains/shop/modules/accounting/domain/value-objects/task-status.value-object';
import { Period } from '@/shared/domain/period.value-object';
import { withRequestContext } from '@/shared/testing/with-request-context';
import type { DatabaseService } from '@/infrustructure/database/database.service';

// Раздел 14 tasks.md (add-task-based-salary-rule) — независимая копия
// теста (зеркало domains/service/modules/accounting/infrastructure/
// repositories/salary-task/salary-task.repository.spec.ts, раздел 9,
// issue #57). Юнит-тест мокает DatabaseService/Prisma-клиент (тот же
// приём, что и PayoutCashboxRecordRepository.spec.ts), а не реальную
// БД — проверяет, что репозиторий ВСЕГДА подставляет/фильтрует
// direction: 'shop' и ни один публичный метод не принимает direction
// параметром снаружи (backend/CLAUDE.md — изоляция направлений на уровне
// кода).
describe('ShopSalaryTaskRepository', () => {
    const buildEntity = (overrides: Partial<{ salaryRuleId: string }> = {}) =>
        ShopSalaryTask.create({
            salaryRuleId: overrides.salaryRuleId ?? 'rule-1',
            period: Period.create('2026-09'),
            deadline: new Date('2026-09-25T00:00:00.000Z'),
            isRecurring: true,
            bitrixTaskId: 'bx-task-1',
            taskStatus: ShopTaskStatus.fromRaw('2'),
        });

    const buildRecord = (overrides: Record<string, unknown> = {}) => ({
        id: 'task-1',
        salaryRuleId: 'rule-1',
        direction: 'shop',
        period: '2026-09',
        deadline: new Date('2026-09-25T00:00:00.000Z'),
        isRecurring: true,
        bitrixTaskId: 'bx-task-1',
        taskStatus: '2',
        lastSyncedAt: null,
        createdAt: new Date('2026-09-01T00:00:00.000Z'),
        updatedAt: new Date('2026-09-01T00:00:00.000Z'),
        ...overrides,
    });

    const buildRepository = () => {
        const create = jest.fn();
        const update = jest.fn();
        const findFirst = jest.fn();
        const findMany = jest.fn();
        const client = {
            salaryTask: { create, update, findFirst, findMany },
        };
        const db = {
            getClient: () => client,
            withTransaction: (callback: () => Promise<unknown>) => callback(),
        } as unknown as DatabaseService;

        const repository = new ShopSalaryTaskRepository(db);
        return { repository, create, update, findFirst, findMany };
    };

    describe('insert', () => {
        it('создаёт запись с direction: "shop"', async () => {
            const { repository, create } = buildRepository();
            create.mockResolvedValueOnce({});

            await withRequestContext(() => repository.insert(buildEntity()));

            expect(create).toHaveBeenCalledTimes(1);
            expect(create).toHaveBeenCalledWith({
                data: expect.objectContaining({
                    direction: 'shop',
                    salaryRuleId: 'rule-1',
                    bitrixTaskId: 'bx-task-1',
                }) as unknown,
            });
        });
    });

    describe('save', () => {
        it('обновляет существующую запись по id', async () => {
            const { repository, update } = buildRepository();
            update.mockResolvedValueOnce({});
            const entity = buildEntity();
            entity.markStatus(
                ShopTaskStatus.fromRaw('5'),
                new Date('2026-09-15T00:00:00.000Z'),
            );

            await withRequestContext(() => repository.save(entity));

            expect(update).toHaveBeenCalledTimes(1);
            expect(update).toHaveBeenCalledWith({
                where: { id: entity.id },
                data: expect.objectContaining({
                    taskStatus: '5',
                }) as unknown,
            });
        });
    });

    describe('findByRuleAndPeriod', () => {
        it('фильтрует по salaryRuleId/period И direction: "shop", не принимая direction параметром', async () => {
            const { repository, findFirst } = buildRepository();
            findFirst.mockResolvedValueOnce(buildRecord());

            const result = await repository.findByRuleAndPeriod(
                'rule-1',
                '2026-09',
            );

            expect(findFirst).toHaveBeenCalledWith({
                where: {
                    salaryRuleId: 'rule-1',
                    period: '2026-09',
                    direction: 'shop',
                },
            });
            expect(result).toBeInstanceOf(ShopSalaryTask);
            expect(result?.bitrixTaskId).toBe('bx-task-1');
        });

        it('возвращает null, если запись не найдена', async () => {
            const { repository, findFirst } = buildRepository();
            findFirst.mockResolvedValueOnce(null);

            const result = await repository.findByRuleAndPeriod(
                'rule-1',
                '2026-09',
            );

            expect(result).toBeNull();
        });
    });

    describe('findActiveForDirection', () => {
        it('запрашивает только direction: "shop" и не-done задачи, без параметра direction на входе', async () => {
            const { repository, findMany } = buildRepository();
            findMany.mockResolvedValueOnce([
                buildRecord(),
                buildRecord({ id: 'task-2' }),
            ]);

            const result = await repository.findActiveForDirection();

            expect(findMany).toHaveBeenCalledWith({
                where: { direction: 'shop', taskStatus: { not: '5' } },
            });
            expect(result).toHaveLength(2);
            expect(result[0]).toBeInstanceOf(ShopSalaryTask);
        });
    });

    // Раздел 17 tasks.md (add-task-based-salary-rule) — вход
    // erpData.taskCompletionStatuses (BuildShopCalculationContextService/
    // GetShopDepartmentSalaryReportService): один запрос на несколько
    // правил сразу за один период.
    describe('findManyByRulesAndPeriod', () => {
        it('ищет по IN(salaryRuleId) + period, ВСЕГДА фильтрует direction: "shop"', async () => {
            const { repository, findMany } = buildRepository();
            findMany.mockResolvedValueOnce([]);

            await repository.findManyByRulesAndPeriod(
                ['rule-1', 'rule-2'],
                '2026-09',
            );

            expect(findMany).toHaveBeenCalledWith({
                where: {
                    direction: 'shop',
                    period: '2026-09',
                    salaryRuleId: { in: ['rule-1', 'rule-2'] },
                },
            });
        });

        it('пустой список правил — не делает запрос в БД, возвращает []', async () => {
            const { repository, findMany } = buildRepository();

            const result = await repository.findManyByRulesAndPeriod(
                [],
                '2026-09',
            );

            expect(result).toEqual([]);
            expect(findMany).not.toHaveBeenCalled();
        });

        it('маппит найденные записи в доменные сущности', async () => {
            const { repository, findMany } = buildRepository();
            findMany.mockResolvedValueOnce([buildRecord()]);

            const result = await repository.findManyByRulesAndPeriod(
                ['rule-1'],
                '2026-09',
            );

            expect(result).toHaveLength(1);
            expect(result[0]?.salaryRuleId).toBe('rule-1');
        });
    });

    // Раздел 17 tasks.md — вход UpdateShopMotivationSchemaHandler при
    // удалении правила TaskCompletion (design.md Decision 6): все НЕ
    // завершённые задачи правила, вне зависимости от периода — разовое
    // правило может быть удалено в периоде, отличном от периода создания
    // его единственной задачи.
    describe('findActiveByRule', () => {
        it('ищет незавершённые задачи ОДНОГО правила по всем периодам, ВСЕГДА фильтрует direction: "shop"', async () => {
            const { repository, findMany } = buildRepository();
            findMany.mockResolvedValueOnce([]);

            await repository.findActiveByRule('rule-1');

            expect(findMany).toHaveBeenCalledWith({
                where: {
                    salaryRuleId: 'rule-1',
                    direction: 'shop',
                    taskStatus: { not: '5' },
                },
            });
        });

        it('маппит найденные записи в доменные сущности', async () => {
            const { repository, findMany } = buildRepository();
            findMany.mockResolvedValueOnce([buildRecord()]);

            const result = await repository.findActiveByRule('rule-1');

            expect(result).toHaveLength(1);
            expect(result[0]?.bitrixTaskId).toBe('bx-task-1');
        });
    });
});
