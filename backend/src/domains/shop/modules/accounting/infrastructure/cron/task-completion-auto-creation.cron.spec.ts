// logCronError пишет в файл на диске (см. cron-file-logger.ts) — мокаем,
// чтобы юнит-тест не оставлял побочных файлов в репозитории (тот же
// приём, что и у ShopSalesPlanAutoCreationCron.spec.ts).
jest.mock('@/shared/cron/cron-file-logger', () => ({
    logCronError: jest.fn(),
}));

import { ShopTaskCompletionAutoCreationCron } from './task-completion-auto-creation.cron';
import type { EnsureShopSalaryTaskForPeriodService } from '@/domains/shop/modules/accounting/application/services/salary-task/ensure-salary-task-for-period.service';
import type { ResolveShopEmployeeSalaryRulesService } from '@/domains/shop/modules/accounting/application/services/calculation/resolve-employee-salary-rules.service';
import type { ShopSalaryRule } from '@/domains/shop/modules/accounting/domain/types/salary-rule.types';
import { logCronError } from '@/shared/cron/cron-file-logger';

// Раздел 16 tasks.md (add-task-based-salary-rule), design.md Decision 4 —
// зеркало TaskCompletionAutoCreationCron направления service (раздел 11,
// issue #57 — независимая копия), по прямому образцу
// ShopSalesPlanAutoCreationCron. Источник "всех активных правил-задач" —
// уже существующий ResolveShopEmployeeSalaryRulesService.forAllTargets()
// (тот же метод, что использует закрытие периода), а не отдельное
// перечисление через SHOP_SALARY_RULE_REPOSITORY.
describe('ShopTaskCompletionAutoCreationCron', () => {
    const buildRule = (id: string, isRecurring: boolean): ShopSalaryRule => ({
        id,
        name: 'Задача',
        type: 'TaskCompletion',
        targetRole: 'OFFLINE_MANAGER',
        config: {
            bitrixTaskTitle: 'Задача',
            isRecurring,
            deadlineTemplate: '2026-01-25T18:00:00.000Z',
            defaultAmount: 5000,
        },
        updatedAt: new Date(),
        calculate: () => null,
    });

    const buildCron = (
        byEmployee: Map<number, { rules: ShopSalaryRule[] }>,
        ensure: jest.Mock = jest.fn().mockResolvedValue(null),
    ) => {
        const salaryRulesResolver = {
            forAllTargets: jest.fn().mockResolvedValue(byEmployee),
        } as unknown as ResolveShopEmployeeSalaryRulesService;
        const ensureSalaryTask = {
            ensure,
        } as unknown as EnsureShopSalaryTaskForPeriodService;
        const cron = new ShopTaskCompletionAutoCreationCron(
            ensureSalaryTask,
            salaryRulesResolver,
        );
        return { cron, ensure };
    };

    afterEach(() => {
        jest.useRealTimers();
        jest.clearAllMocks();
    });

    it('вызывает ensure() для каждого регулярного TaskCompletion-правила каждого сотрудника за текущий период (UTC)', async () => {
        jest.useFakeTimers().setSystemTime(
            new Date('2026-10-01T00:00:00.000Z'),
        );
        const byEmployee = new Map([
            [1, { rules: [buildRule('rule-1', true)] }],
            [
                2,
                {
                    rules: [
                        buildRule('rule-2', true),
                        buildRule('rule-once', false),
                    ],
                },
            ],
        ]);
        const { cron, ensure } = buildCron(byEmployee);

        await cron.run();

        expect(ensure).toHaveBeenCalledTimes(2);
        expect(ensure).toHaveBeenCalledWith('rule-1', '2026-10', 1);
        expect(ensure).toHaveBeenCalledWith('rule-2', '2026-10', 2);
    });

    it('ошибка ensure() прерывает текущий проход, но не выбрасывает исключение из run() — логируется', async () => {
        const byEmployee = new Map([
            [1, { rules: [buildRule('rule-1', true)] }],
            [2, { rules: [buildRule('rule-2', true)] }],
        ]);
        const ensure = jest.fn().mockRejectedValue(new Error('bitrix down'));
        const { cron } = buildCron(byEmployee, ensure);

        await expect(cron.run()).resolves.toBeUndefined();

        expect(logCronError).toHaveBeenCalledWith(
            'ShopTaskCompletionAutoCreationCron.run',
            expect.any(Error),
            expect.objectContaining({ period: expect.any(String) as string }),
        );
    });
});
