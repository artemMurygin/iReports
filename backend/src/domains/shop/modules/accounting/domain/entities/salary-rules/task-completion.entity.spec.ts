import { TaskCompletionShop } from './task-completion.entity';
import { ShopSalaryTask } from '@/domains/shop/modules/accounting/domain/entities/salary-task/salary-task.entity';
import type { ShopCalculationContext } from '@/domains/shop/modules/accounting/domain/types/calculation-context.types';
import type { ShopCalculationErpData } from '@/domains/shop/modules/accounting/domain/types/calculation-data.types';

// openspec/changes/replace-bitrix-task-integration — зеркало раздела теста
// domains/service/modules/accounting/domain/entities/salary-rules/
// task-completion.entity.spec.ts, независимая копия для направления shop
// (issue #57): TaskCompletionShop.calculate() —
// spec shop/accounting#requirement-правило-за-выполнение-задачи-не-видно-в-прогнозе-до-выполнения
// (строка отсутствует в отчёте, пока задача не в статусе «Закрыта успешно»)
// и #requirement-сумма-начисления-по-правилу-за-выполнение-задачи-задаётся-руководителем-вручную
// (amount всегда равен config.defaultAmount; requiresManualInput всегда
// true, design.md Decision 5).
const buildRule = () =>
    TaskCompletionShop.create({
        type: 'TaskCompletion',
        name: 'Сверить остатки склада',
        targetRole: 'ONLINE_MANAGER',
        config: {
            taskId: 'task-1',
            taskTitleTemplate: 'Сверить остатки склада за месяц',
            taskDescriptionTemplate: 'Свериться с МойСклад',
            isRecurring: true,
            deadlineTemplate: '2026-08-05',
            defaultAmount: 5000,
        },
    });

const buildContext = (
    erpData?: ShopCalculationErpData,
): ShopCalculationContext => ({
    employee: {
        id: 1,
        identities: [],
    },
    period: {
        direction: 'shop',
        period: '2026-08',
        from: new Date('2026-08-01T00:00:00.000Z'),
        to: new Date('2026-08-31T23:59:59.999Z'),
        status: 'OPEN',
    },
    mode: 'FACT',
    erpData,
    salesPerformance: null,
});

describe('TaskCompletionShop', () => {
    describe('create', () => {
        // design.md решение 4 — CreateShopSalaryRuleHandler больше не
        // вызывает tasks вообще: taskId приходит в теле запроса и
        // сохраняется как taskIdByPeriod[текущийПериод] прямо здесь, в
        // фабрике правила (единственное место, где домен-объект строится
        // из wire-формы запроса).
        it('создаёт правило с генерируемым id, типом TaskCompletion и taskId в taskIdByPeriod текущего периода', () => {
            const rule = buildRule();

            expect(rule).toBeInstanceOf(TaskCompletionShop);
            expect(rule.type).toBe('TaskCompletion');
            expect(rule.id).toEqual(expect.any(String));
            expect(rule.name).toBe('Сверить остатки склада');
            expect(rule.targetRole).toBe('ONLINE_MANAGER');
            expect(rule.config.taskTitleTemplate).toBe(
                'Сверить остатки склада за месяц',
            );
            expect(Object.values(rule.config.taskIdByPeriod)).toEqual([
                'task-1',
            ]);
        });
    });

    describe('calculate', () => {
        it('возвращает null, когда erpData не содержит статус связанной задачи вовсе', () => {
            const rule = buildRule();

            expect(
                rule.calculate(
                    buildContext({
                        productSoldItems: [],
                        taskCompletionStatuses: {},
                    }),
                ),
            ).toBeNull();
        });

        it('возвращает null, когда erpData вовсе не заполнен (undefined)', () => {
            const rule = buildRule();

            expect(rule.calculate(buildContext(undefined))).toBeNull();
        });

        it('возвращает null, когда статус связанной задачи не CLOSED_SUCCESSFULLY (в т.ч. DONE)', () => {
            const rule = buildRule();

            const line = rule.calculate(
                buildContext({
                    productSoldItems: [],
                    taskCompletionStatuses: {
                        [rule.id]: ShopSalaryTask.create({
                            taskId: 'task-1',
                            status: 'DONE',
                        }),
                    },
                }),
            );

            expect(line).toBeNull();
        });

        it('возвращает CalculationLine с amount из config.defaultAmount и requiresManualInput true, когда статус CLOSED_SUCCESSFULLY', () => {
            const rule = buildRule();

            const line = rule.calculate(
                buildContext({
                    productSoldItems: [],
                    taskCompletionStatuses: {
                        [rule.id]: ShopSalaryTask.create({
                            taskId: 'task-1',
                            status: 'CLOSED_SUCCESSFULLY',
                        }),
                    },
                }),
            );

            expect(line).not.toBeNull();
            expect(line?.ruleId).toBe(rule.id);
            expect(line?.amount).toBe(5000);
            expect(line?.requiresManualInput).toBe(true);
            expect(line?.sources).toEqual([
                {
                    type: 'taskCompletion',
                    id: 'task-1',
                    label: 'Сверить остатки склада за месяц',
                    link: '/tasks/task-1',
                },
            ]);
        });

        // Раздел 10.1/15.1 (проектная нумерация add-task-based-salary-rule) —
        // amount/requiresManualInput не зависят от того, была ли уже введена
        // сумма в документе начисления: сумма живёт только на
        // ShopSalaryAccrualLine (design.md Decision 5), calculate() её не
        // читает и не пересчитывает вовсе.
        it('всегда возвращает amount из config.defaultAmount и requiresManualInput true при повторных вызовах со статусом CLOSED_SUCCESSFULLY', () => {
            const rule = buildRule();
            const context = buildContext({
                productSoldItems: [],
                taskCompletionStatuses: {
                    [rule.id]: ShopSalaryTask.create({
                        taskId: 'task-1',
                        status: 'CLOSED_SUCCESSFULLY',
                    }),
                },
            });

            const first = rule.calculate(context);
            const second = rule.calculate(context);

            expect(first?.amount).toBe(5000);
            expect(first?.requiresManualInput).toBe(true);
            expect(second?.amount).toBe(5000);
            expect(second?.requiresManualInput).toBe(true);
        });
    });
});
