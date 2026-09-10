import { ShopSalaryAccrualRepository } from './salary-accrual.repository';
import type { DatabaseService } from '@/infrustructure/database/database.service';

// Тест findLineByTaskId, добавленного ShopSalaryAccrualRepositoryPort
// разделом 16 tasks.md (add-task-salary-rule-links-comments) — зеркало
// domains/service/.../salary-accrual.repository.spec.ts. direction здесь не
// параметр метода (зафиксирован 'shop' реализацией, как и у остальных
// методов этого порта).
describe('ShopSalaryAccrualRepository', () => {
    const buildLineRecord = (overrides: Record<string, unknown> = {}) => ({
        id: 'line-1',
        accrualId: 'accrual-1',
        position: 0,
        ruleId: 'rule-1',
        type: 'TaskCompletion',
        name: 'За выполнение задачи',
        targetRole: 'OFFLINE_MANAGER',
        salaryBasis: null,
        quantity: null,
        rate: null,
        originalAmount: 0,
        amount: 5000,
        sources: [{ type: 'taskCompletion', id: 'task-1' }],
        comment: 'Готово',
        requiresManualInput: false,
        status: 'DRAFT',
        createdAt: new Date('2026-01-01T00:00:00.000Z'),
        updatedAt: new Date('2026-01-01T00:00:00.000Z'),
        adjustments: [],
        ...overrides,
    });

    const buildRepository = () => {
        const findMany = jest.fn();
        const client = {
            salaryAccrualLine: { findMany },
        };
        const db = {
            getClient: () => client,
            withTransaction: (callback: () => Promise<unknown>) => callback(),
        } as unknown as DatabaseService;

        const repository = new ShopSalaryAccrualRepository(db);
        return { repository, findMany };
    };

    describe('findLineByTaskId', () => {
        // spec: shop/accounting#requirement-зарплатное-правило-и-начисление-доступны-для-поиска-по-идентификатору-задачи
        it('находит строку, чей sources содержит {type: taskCompletion, id: taskId}', async () => {
            const { repository, findMany } = buildRepository();
            findMany.mockResolvedValueOnce([buildLineRecord()]);

            const line = await repository.findLineByTaskId('task-1');

            expect(findMany).toHaveBeenCalledWith({
                where: {
                    type: 'TaskCompletion',
                    accrual: { direction: 'shop' },
                },
                include: { adjustments: true },
            });
            expect(line).not.toBeNull();
            expect(line?.id).toBe('line-1');
        });

        it('возвращает null, если ни одна строка не ссылается на taskId', async () => {
            const { repository, findMany } = buildRepository();
            findMany.mockResolvedValueOnce([
                buildLineRecord({
                    sources: [{ type: 'taskCompletion', id: 'other-task' }],
                }),
            ]);

            const line = await repository.findLineByTaskId('task-1');

            expect(line).toBeNull();
        });
    });
});
