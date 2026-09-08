import { SalaryTaskRepository } from './salary-task.repository';
import { Prisma } from '../../../../../../../../prisma/generated/prisma/schema/client';
import { SalaryTask } from '@/domains/service/modules/accounting/domain/entities/salary-task/salary-task.entity';
import { TaskStatus } from '@/domains/service/modules/accounting/domain/value-objects/task-status.value-object';
import { SalaryTaskAlreadyExistsException } from '@/domains/service/modules/accounting/domain/exceptions/salary-task.exception';
import { BITRIX_TASK_STATUS_COMPLETED } from '@/integrations/bitrix/schema';
import { withRequestContext } from '@/shared/testing/with-request-context';
import type { DatabaseService } from '@/infrustructure/database/database.service';

// Раздел 9 tasks.md (add-task-based-salary-rule): SalaryTaskRepository
// (направление service) поверх общей таблицы salary_tasks (задача 1.1,
// backend/CLAUDE.md "Общие таблицы между service и shop") — ВСЕГДА
// подставляет/фильтрует direction: 'service', не принимает direction
// параметром снаружи (изоляция направлений на уровне кода). Зеркало
// ShopSalaryTaskRepository (раздел 14) — независимый класс, здесь не
// проверяется.
describe('SalaryTaskRepository', () => {
    const buildTask = (
        overrides: Partial<{
            salaryRuleId: string;
            period: string;
            bitrixTaskId: string;
        }> = {},
    ) =>
        SalaryTask.create({
            salaryRuleId: overrides.salaryRuleId ?? 'rule-1',
            period: overrides.period ?? '2026-09',
            deadline: new Date('2026-09-30T23:59:59.000Z'),
            isRecurring: true,
            bitrixTaskId: overrides.bitrixTaskId ?? '777',
            taskStatus: TaskStatus.fromRaw('2'),
        });

    const buildRepository = () => {
        const create = jest.fn();
        const update = jest.fn();
        const findUnique = jest.fn();
        const findMany = jest.fn();
        const client = {
            salaryTask: { create, update, findUnique, findMany },
        };
        const db = {
            getClient: () => client,
            withTransaction: (callback: () => Promise<unknown>) => callback(),
        } as unknown as DatabaseService;

        const repository = new SalaryTaskRepository(db);
        return { repository, create, update, findUnique, findMany };
    };

    describe('findByRuleAndPeriod', () => {
        it('ищет по составному уникальному ключу И ВСЕГДА фильтрует direction: "service"', async () => {
            const { repository, findUnique } = buildRepository();
            findUnique.mockResolvedValueOnce(null);

            await repository.findByRuleAndPeriod('rule-1', '2026-09');

            expect(findUnique).toHaveBeenCalledWith({
                where: {
                    salaryRuleId_period: {
                        salaryRuleId: 'rule-1',
                        period: '2026-09',
                    },
                    direction: 'service',
                },
            });
        });

        it('маппит найденную запись в доменную сущность', async () => {
            const { repository, findUnique } = buildRepository();
            const now = new Date('2026-09-01T00:00:00.000Z');
            findUnique.mockResolvedValueOnce({
                id: 'task-1',
                salaryRuleId: 'rule-1',
                direction: 'service',
                period: '2026-09',
                deadline: new Date('2026-09-30T23:59:59.000Z'),
                isRecurring: true,
                bitrixTaskId: '777',
                taskStatus: '2',
                lastSyncedAt: null,
                createdAt: now,
                updatedAt: now,
            });

            const result = await repository.findByRuleAndPeriod(
                'rule-1',
                '2026-09',
            );

            expect(result?.bitrixTaskId).toBe('777');
            expect(result?.taskStatus.code).toBe('2');
        });

        it('нет записи — null', async () => {
            const { repository, findUnique } = buildRepository();
            findUnique.mockResolvedValueOnce(null);

            const result = await repository.findByRuleAndPeriod(
                'rule-1',
                '2026-09',
            );

            expect(result).toBeNull();
        });
    });

    describe('findActiveForDirection', () => {
        it('не принимает direction параметром и ВСЕГДА фильтрует direction: "service" + taskStatus не "Завершена"', async () => {
            const { repository, findMany } = buildRepository();
            findMany.mockResolvedValueOnce([]);

            // Метод намеренно без аргументов — направление зашито в
            // реализации (см. WHY выше и в самом репозитории).
            await repository.findActiveForDirection();

            expect(findMany).toHaveBeenCalledWith({
                where: {
                    direction: 'service',
                    taskStatus: {
                        not: String(BITRIX_TASK_STATUS_COMPLETED),
                    },
                },
            });
        });

        it('маппит найденные записи в доменные сущности', async () => {
            const { repository, findMany } = buildRepository();
            const now = new Date('2026-09-01T00:00:00.000Z');
            findMany.mockResolvedValueOnce([
                {
                    id: 'task-1',
                    salaryRuleId: 'rule-1',
                    direction: 'service',
                    period: '2026-09',
                    deadline: new Date('2026-09-30T23:59:59.000Z'),
                    isRecurring: true,
                    bitrixTaskId: '777',
                    taskStatus: '2',
                    lastSyncedAt: null,
                    createdAt: now,
                    updatedAt: now,
                },
            ]);

            const result = await repository.findActiveForDirection();

            expect(result).toHaveLength(1);
            expect(result[0]?.bitrixTaskId).toBe('777');
        });
    });

    describe('insert', () => {
        it('создаёт запись с direction: "service", подставленным репозиторием', async () => {
            const { repository, create } = buildRepository();
            create.mockResolvedValueOnce({});

            await withRequestContext(() => repository.insert(buildTask()));

            expect(create).toHaveBeenCalledTimes(1);
            expect(create).toHaveBeenCalledWith({
                data: expect.objectContaining({
                    salaryRuleId: 'rule-1',
                    period: '2026-09',
                    direction: 'service',
                    bitrixTaskId: '777',
                }) as unknown,
            });
        });

        it('повторная вставка того же (salaryRuleId, period) (P2002) — понятное доменное исключение вместо сырого Prisma-эксепшна', async () => {
            const { repository, create } = buildRepository();
            const duplicateKeyError = new Prisma.PrismaClientKnownRequestError(
                'Unique constraint failed on the fields: (`salary_rule_id`,`period`)',
                { code: 'P2002', clientVersion: 'test' },
            );
            create.mockRejectedValueOnce(duplicateKeyError);

            const error = await withRequestContext(() =>
                repository.insert(buildTask()).catch((e: unknown) => e),
            );

            expect(error).toBeInstanceOf(SalaryTaskAlreadyExistsException);
            expect(create).toHaveBeenCalledTimes(1);
        });

        it('другая ошибка Prisma (не P2002) пробрасывается как есть', async () => {
            const { repository, create } = buildRepository();
            const otherError = new Prisma.PrismaClientKnownRequestError(
                'Some other constraint failed',
                { code: 'P2003', clientVersion: 'test' },
            );
            create.mockRejectedValueOnce(otherError);

            const error = await withRequestContext(() =>
                repository.insert(buildTask()).catch((e: unknown) => e),
            );

            expect(error).toBe(otherError);
        });
    });

    describe('save', () => {
        it('обновляет существующую запись по id (например, после markStatus)', async () => {
            const { repository, update } = buildRepository();
            update.mockResolvedValueOnce({});
            const task = buildTask();
            task.markStatus(TaskStatus.fromRaw('5'));

            await withRequestContext(() => repository.save(task));

            expect(update).toHaveBeenCalledWith({
                where: { id: task.id },
                data: expect.objectContaining({
                    taskStatus: '5',
                }) as unknown,
            });
        });
    });

    // Раздел 12 tasks.md (add-task-based-salary-rule) — вход
    // erpData.taskCompletionStatuses (BuildServiceCalculationContextService/
    // GetDepartmentSalaryReportService): один запрос на несколько правил
    // сразу за один период.
    describe('findManyByRulesAndPeriod', () => {
        it('ищет по IN(salaryRuleId) + period, ВСЕГДА фильтрует direction: "service"', async () => {
            const { repository, findMany } = buildRepository();
            findMany.mockResolvedValueOnce([]);

            await repository.findManyByRulesAndPeriod(
                ['rule-1', 'rule-2'],
                '2026-09',
            );

            expect(findMany).toHaveBeenCalledWith({
                where: {
                    direction: 'service',
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
            const now = new Date('2026-09-01T00:00:00.000Z');
            findMany.mockResolvedValueOnce([
                {
                    id: 'task-1',
                    salaryRuleId: 'rule-1',
                    direction: 'service',
                    period: '2026-09',
                    deadline: new Date('2026-09-30T23:59:59.000Z'),
                    isRecurring: true,
                    bitrixTaskId: '777',
                    taskStatus: '5',
                    lastSyncedAt: null,
                    createdAt: now,
                    updatedAt: now,
                },
            ]);

            const result = await repository.findManyByRulesAndPeriod(
                ['rule-1'],
                '2026-09',
            );

            expect(result).toHaveLength(1);
            expect(result[0]?.salaryRuleId).toBe('rule-1');
            expect(result[0]?.taskStatus.code).toBe('5');
        });
    });

    // Раздел 12 tasks.md — вход UpdateMotivationSchemaHandler при удалении
    // правила TaskCompletion (design.md Decision 6): все НЕ завершённые
    // задачи правила, вне зависимости от периода — разовое правило может
    // быть удалено в периоде, отличном от периода создания его
    // единственной задачи.
    describe('findActiveByRule', () => {
        it('ищет незавершённые задачи ОДНОГО правила по всем периодам, ВСЕГДА фильтрует direction: "service"', async () => {
            const { repository, findMany } = buildRepository();
            findMany.mockResolvedValueOnce([]);

            await repository.findActiveByRule('rule-1');

            expect(findMany).toHaveBeenCalledWith({
                where: {
                    salaryRuleId: 'rule-1',
                    direction: 'service',
                    taskStatus: {
                        not: String(BITRIX_TASK_STATUS_COMPLETED),
                    },
                },
            });
        });

        it('маппит найденные записи в доменные сущности', async () => {
            const { repository, findMany } = buildRepository();
            const now = new Date('2026-09-01T00:00:00.000Z');
            findMany.mockResolvedValueOnce([
                {
                    id: 'task-1',
                    salaryRuleId: 'rule-1',
                    direction: 'service',
                    period: '2026-01',
                    deadline: new Date('2026-01-15T00:00:00.000Z'),
                    isRecurring: false,
                    bitrixTaskId: '999',
                    taskStatus: '2',
                    lastSyncedAt: null,
                    createdAt: now,
                    updatedAt: now,
                },
            ]);

            const result = await repository.findActiveByRule('rule-1');

            expect(result).toHaveLength(1);
            expect(result[0]?.bitrixTaskId).toBe('999');
        });
    });
});
