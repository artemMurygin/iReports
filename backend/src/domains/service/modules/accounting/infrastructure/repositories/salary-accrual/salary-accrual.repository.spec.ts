import { SalaryAccrualRepository } from './salary-accrual.repository';
import type { DatabaseService } from '@/infrustructure/database/database.service';

// Тест findLineByTaskId, добавленного SalaryAccrualRepositoryPort разделом
// 16 tasks.md (add-task-salary-rule-links-comments). Юнит-тест мокает
// DatabaseService/Prisma-клиент, как и остальные новые read-методы этого
// change (см. .../motivation-schema/salary-rule.repository.spec.ts) —
// остальные методы этого репозитория тестами пока не покрыты, покрытие
// идёт через e2e (salary-accruals.e2e.spec.ts).
describe('SalaryAccrualRepository', () => {
    const buildLineRecord = (overrides: Record<string, unknown> = {}) => ({
        id: 'line-1',
        accrualId: 'accrual-1',
        position: 0,
        ruleId: 'rule-1',
        type: 'TaskCompletion',
        name: 'За выполнение задачи',
        targetRole: 'ENGINEER',
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

        const repository = new SalaryAccrualRepository(db);
        return { repository, findMany };
    };

    describe('findLineByTaskId', () => {
        // spec: service/accounting#requirement-зарплатное-правило-и-начисление-доступны-для-поиска-по-идентификатору-задачи
        it('находит строку, чей sources содержит {type: taskCompletion, id: taskId}', async () => {
            const { repository, findMany } = buildRepository();
            findMany.mockResolvedValueOnce([buildLineRecord()]);

            const line = await repository.findLineByTaskId('service', 'task-1');

            expect(findMany).toHaveBeenCalledWith({
                where: {
                    type: 'TaskCompletion',
                    accrual: { direction: 'service' },
                },
                include: { adjustments: true },
            });
            expect(line).not.toBeNull();
            expect(line?.id).toBe('line-1');
            expect(line?.amount).toBe(5000);
        });

        it('возвращает null, если ни одна строка не ссылается на taskId', async () => {
            const { repository, findMany } = buildRepository();
            findMany.mockResolvedValueOnce([
                buildLineRecord({
                    sources: [{ type: 'taskCompletion', id: 'other-task' }],
                }),
            ]);

            const line = await repository.findLineByTaskId('service', 'task-1');

            expect(line).toBeNull();
        });

        it('возвращает null, если строк типа TaskCompletion нет вовсе', async () => {
            const { repository, findMany } = buildRepository();
            findMany.mockResolvedValueOnce([]);

            const line = await repository.findLineByTaskId('service', 'task-1');

            expect(line).toBeNull();
        });
    });
});
