import { ShopSalaryRuleRepository } from './salary-rule.repository';
import type { DatabaseService } from '@/infrustructure/database/database.service';

// Раздел 16 tasks.md (add-task-based-salary-rule) — тест ДО реализации
// (TDD) для нового метода findById, добавленного ShopSalaryRuleRepositoryPort
// ради EnsureShopSalaryTaskForPeriodService (зеркало findById направления
// service, раздел 11). Юнит-тест мокает DatabaseService/Prisma-клиент (тот
// же приём, что и у ShopSalaryTaskRepository.spec.ts) — insert/
// deleteByIds/update этого репозитория уже покрыты только
// косвенно через хендлеры, новый read-метод получает собственное покрытие
// здесь.
describe('ShopSalaryRuleRepository', () => {
    const buildRuleRecord = (overrides: Record<string, unknown> = {}) => ({
        id: 'rule-1',
        motivationSchemaId: 'schema-1',
        type: 'TaskCompletion',
        name: 'Собрать отчёт',
        targetRole: 'OFFLINE_MANAGER',
        direction: 'shop',
        props: {
            bitrixTaskTitle: 'Собрать отчёт по продажам',
            taskDescription: 'Описание задачи',
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
        const client = {
            salaryRule: { create, deleteMany, findFirst },
        };
        const db = {
            getClient: () => client,
            withTransaction: (callback: () => Promise<unknown>) => callback(),
        } as unknown as DatabaseService;

        const repository = new ShopSalaryRuleRepository(db);
        return { repository, findFirst };
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
});
