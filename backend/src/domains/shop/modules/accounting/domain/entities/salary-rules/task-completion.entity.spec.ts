import { TaskCompletionShop } from './task-completion.entity';
import { ShopSalaryTask } from '@/domains/shop/modules/accounting/domain/entities/salary-task/salary-task.entity';
import type { ShopCalculationContext } from '@/domains/shop/modules/accounting/domain/types/calculation-context.types';
import type { ShopCalculationErpData } from '@/domains/shop/modules/accounting/domain/types/calculation-data.types';

// openspec/changes/replace-bitrix-task-integration — зеркало раздела теста
// domains/service/modules/accounting/domain/entities/salary-rules/
// task-completion.entity.spec.ts, независимая копия для направления shop
// (issue #57): TaskCompletionShop.calculate() —
// spec shop/accounting#requirement-строка-правила-за-выполнение-задачи-появляется-сразу-и-растёт-по-статусу-задачи
// (task-completion-progressive-visibility: null только пока задача периода
// вообще не заведена; иначе PROGNOSE = defaultAmount сразу, FACT = 0 до
// статуса «Выполнена» и далее не откатывается) и
// #requirement-сумма-начисления-по-правилу-за-выполнение-задачи-задаётся-руководителем-вручную
// (requiresManualInput всегда true, design.md Decision 5).
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
    mode: ShopCalculationContext['mode'] = 'FACT',
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
    mode,
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

        const buildLine = (
            status: string,
            mode: ShopCalculationContext['mode'],
        ) => {
            const rule = buildRule();
            const line = rule.calculate(
                buildContext(
                    {
                        productSoldItems: [],
                        taskCompletionStatuses: {
                            [rule.id]: ShopSalaryTask.create({
                                taskId: 'task-1',
                                status,
                            }),
                        },
                    },
                    mode,
                ),
            );
            return { rule, line };
        };

        // FR1 of task-completion-progressive-visibility: PROGNOSE =
        // defaultAmount сразу, вне зависимости от статуса задачи.
        it.each([
            'NEW',
            'IN_PROGRESS',
            'DONE',
            'CLOSED_SUCCESSFULLY',
            'CLOSED_UNSUCCESSFULLY',
            'REWORK',
        ])('FR1: PROGNOSE = defaultAmount при любом статусе (%s)', (status) => {
            const prognose = buildLine(status, 'PROGNOSE');

            expect(prognose.line).not.toBeNull();
            expect(prognose.line?.amount).toBe(5000);
        });

        // FR2: FACT = 0, пока задача не достигла статуса «Выполнена».
        it.each(['NEW', 'IN_PROGRESS'])(
            'FR2: FACT = 0, пока задача в статусе %s',
            (status) => {
                const fact = buildLine(status, 'FACT');

                expect(fact.line).not.toBeNull();
                expect(fact.line?.amount).toBe(0);
            },
        );

        // FR3: FACT становится равен defaultAmount, начиная со статуса
        // «Выполнена», и НЕ откатывается автоматически на более поздних
        // статусах.
        it.each([
            'DONE',
            'CLOSED_SUCCESSFULLY',
            'CLOSED_UNSUCCESSFULLY',
            'REWORK',
        ])('FR3: FACT = defaultAmount на статусе %s', (status) => {
            const fact = buildLine(status, 'FACT');

            expect(fact.line?.amount).toBe(5000);
        });

        it('requiresManualInput и sources не зависят от режима/статуса', () => {
            const { rule, line } = buildLine('CLOSED_SUCCESSFULLY', 'FACT');

            expect(line?.ruleId).toBe(rule.id);
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
        it('всегда возвращает одинаковый amount при повторных вызовах со статусом CLOSED_SUCCESSFULLY', () => {
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
