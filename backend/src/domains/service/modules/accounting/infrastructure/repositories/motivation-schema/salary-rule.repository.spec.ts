import { SalaryRuleRepository } from './salary-rule.repository';
import type { DatabaseService } from '@/infrustructure/database/database.service';
import { Period } from '@/shared/domain/period.value-object';

// Тесты findByTaskId/findMotivationSchemaId, добавленных
// SalaryRuleRepositoryPort разделами 15/18 tasks.md
// (add-task-salary-rule-links-comments). insert/deleteByIds/findById/update
// этого репозитория тестами пока не покрыты — новые read-методы получают
// собственное покрытие здесь (тот же приём, что и у
// shop/.../salary-rule.repository.spec.ts, findById которого уже был
// покрыт раньше, вне этого change).
describe('SalaryRuleRepository', () => {
    const currentPeriod = Period.current().getValue();

    const buildTaskCompletionRecord = (
        overrides: Record<string, unknown> = {},
    ) => ({
        id: 'rule-1',
        motivationSchemaId: 'schema-1',
        type: 'TaskCompletion',
        name: 'Собрать отчёт',
        targetRole: 'ENGINEER',
        direction: 'service',
        props: {
            taskIdByPeriod: { [currentPeriod]: 'task-1' },
            taskTitleTemplate: 'Собрать отчёт по продажам',
            taskDescriptionTemplate: 'Описание задачи',
            isRecurring: true,
            deadlineTemplate: '2026-01-25T18:00:00.000Z',
            defaultAmount: 5000,
        },
        createdAt: new Date('2026-01-01T00:00:00.000Z'),
        updatedAt: new Date('2026-01-01T00:00:00.000Z'),
        ...overrides,
    });

    const buildRepository = () => {
        const findMany = jest.fn();
        const findFirst = jest.fn();
        const client = {
            salaryRule: { findMany, findFirst },
        };
        const db = {
            getClient: () => client,
            withTransaction: (callback: () => Promise<unknown>) => callback(),
        } as unknown as DatabaseService;

        const repository = new SalaryRuleRepository(db);
        return { repository, findMany, findFirst };
    };

    describe('findByTaskId', () => {
        // spec: service/accounting#requirement-зарплатное-правило-и-начисление-доступны-для-поиска-по-идентификатору-задачи
        it('находит правило TaskCompletion, ссылающееся на taskId в текущем периоде', async () => {
            const { repository, findMany } = buildRepository();
            findMany.mockResolvedValueOnce([
                buildTaskCompletionRecord({
                    id: 'rule-other',
                    props: {
                        taskIdByPeriod: { [currentPeriod]: 'task-other' },
                        taskTitleTemplate: 'Шаблон',
                        isRecurring: false,
                        deadlineTemplate: '2026-01-25T18:00:00.000Z',
                        defaultAmount: 1000,
                    },
                }),
                buildTaskCompletionRecord(),
            ]);

            const rule = await repository.findByTaskId('task-1');

            expect(findMany).toHaveBeenCalledWith({
                where: { type: 'TaskCompletion', direction: 'service' },
            });
            expect(rule).not.toBeNull();
            expect(rule?.id).toBe('rule-1');
        });

        it('возвращает null, если ни одно правило не ссылается на taskId в текущем периоде', async () => {
            const { repository, findMany } = buildRepository();
            findMany.mockResolvedValueOnce([
                buildTaskCompletionRecord({
                    props: {
                        taskIdByPeriod: { [currentPeriod]: 'other-task' },
                        taskTitleTemplate: 'Шаблон',
                        isRecurring: false,
                        deadlineTemplate: '2026-01-25T18:00:00.000Z',
                        defaultAmount: 1000,
                    },
                }),
            ]);

            const rule = await repository.findByTaskId('task-1');

            expect(rule).toBeNull();
        });

        it('игнорирует ссылку правила на taskId за ПРОШЛЫЙ период', async () => {
            const { repository, findMany } = buildRepository();
            findMany.mockResolvedValueOnce([
                buildTaskCompletionRecord({
                    props: {
                        taskIdByPeriod: { '2020-01': 'task-1' },
                        taskTitleTemplate: 'Шаблон',
                        isRecurring: true,
                        deadlineTemplate: '2026-01-25T18:00:00.000Z',
                        defaultAmount: 1000,
                    },
                }),
            ]);

            const rule = await repository.findByTaskId('task-1');

            expect(rule).toBeNull();
        });
    });

    describe('findMotivationSchemaId', () => {
        it('возвращает motivationSchemaId найденного правила направления service', async () => {
            const { repository, findFirst } = buildRepository();
            findFirst.mockResolvedValueOnce({ motivationSchemaId: 'schema-1' });

            const id = await repository.findMotivationSchemaId('rule-1');

            expect(findFirst).toHaveBeenCalledWith({
                where: { id: 'rule-1', direction: 'service' },
                select: { motivationSchemaId: true },
            });
            expect(id).toBe('schema-1');
        });

        it('возвращает null, если правило не найдено', async () => {
            const { repository, findFirst } = buildRepository();
            findFirst.mockResolvedValueOnce(null);

            const id = await repository.findMotivationSchemaId('rule-unknown');

            expect(id).toBeNull();
        });
    });
});
