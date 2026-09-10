import { ShopSalaryRuleRepository } from './salary-rule.repository';
import type { DatabaseService } from '@/infrustructure/database/database.service';
import { Period } from '@/shared/domain/period.value-object';

// Тест метода findById, добавленного ShopSalaryRuleRepositoryPort ради
// EnsureShopSalaryTaskForPeriodService (зеркало findById направления
// service). Юнит-тест мокает DatabaseService/Prisma-клиент — insert/
// deleteByIds/update этого репозитория уже покрыты только косвенно через
// хендлеры, новый read-метод получает собственное покрытие здесь.
//
// findByTaskId/findMotivationSchemaId ниже — разделы 15/18 tasks.md
// (add-task-salary-rule-links-comments), зеркало
// domains/service/.../salary-rule.repository.spec.ts.
describe('ShopSalaryRuleRepository', () => {
    const currentPeriod = Period.current().getValue();

    const buildRuleRecord = (overrides: Record<string, unknown> = {}) => ({
        id: 'rule-1',
        motivationSchemaId: 'schema-1',
        type: 'TaskCompletion',
        name: 'Собрать отчёт',
        targetRole: 'OFFLINE_MANAGER',
        direction: 'shop',
        props: {
            taskIdByPeriod: { '2026-01': 'task-1' },
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
        const create = jest.fn();
        const deleteMany = jest.fn();
        const findFirst = jest.fn();
        const findMany = jest.fn();
        const client = {
            salaryRule: { create, deleteMany, findFirst, findMany },
        };
        const db = {
            getClient: () => client,
            withTransaction: (callback: () => Promise<unknown>) => callback(),
        } as unknown as DatabaseService;

        const repository = new ShopSalaryRuleRepository(db);
        return { repository, findFirst, findMany };
    };

    describe('findById', () => {
        it('фильтрует по id И direction: "shop", маппит найденную запись в домен', async () => {
            const { repository, findFirst } = buildRepository();
            findFirst.mockResolvedValueOnce(buildRuleRecord());

            const rule = await repository.findById('rule-1');

            expect(findFirst).toHaveBeenCalledWith({
                where: { id: 'rule-1', direction: 'shop' },
            });
            expect(rule).not.toBeNull();
            expect(rule?.id).toBe('rule-1');
            expect(rule?.type).toBe('TaskCompletion');
        });

        it('возвращает null, если правило не найдено', async () => {
            const { repository, findFirst } = buildRepository();
            findFirst.mockResolvedValueOnce(null);

            const rule = await repository.findById('rule-unknown');

            expect(rule).toBeNull();
        });
    });

    describe('findByTaskId', () => {
        // spec: shop/accounting#requirement-зарплатное-правило-и-начисление-доступны-для-поиска-по-идентификатору-задачи
        it('находит правило TaskCompletion, ссылающееся на taskId в текущем периоде', async () => {
            const { repository, findMany } = buildRepository();
            findMany.mockResolvedValueOnce([
                buildRuleRecord({
                    props: {
                        taskIdByPeriod: { [currentPeriod]: 'task-1' },
                        taskTitleTemplate: 'Собрать отчёт по продажам',
                        isRecurring: true,
                        deadlineTemplate: '2026-01-25T18:00:00.000Z',
                        defaultAmount: 5000,
                    },
                }),
            ]);

            const rule = await repository.findByTaskId('task-1');

            expect(findMany).toHaveBeenCalledWith({
                where: { type: 'TaskCompletion', direction: 'shop' },
            });
            expect(rule).not.toBeNull();
            expect(rule?.id).toBe('rule-1');
        });

        it('возвращает null, если ни одно правило не ссылается на taskId в текущем периоде', async () => {
            const { repository, findMany } = buildRepository();
            findMany.mockResolvedValueOnce([buildRuleRecord()]);

            const rule = await repository.findByTaskId('task-unknown');

            expect(rule).toBeNull();
        });
    });

    describe('findMotivationSchemaId', () => {
        it('возвращает motivationSchemaId найденного правила направления shop', async () => {
            const { repository, findFirst } = buildRepository();
            findFirst.mockResolvedValueOnce({ motivationSchemaId: 'schema-1' });

            const id = await repository.findMotivationSchemaId('rule-1');

            expect(findFirst).toHaveBeenCalledWith({
                where: { id: 'rule-1', direction: 'shop' },
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
