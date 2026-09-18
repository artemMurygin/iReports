import {
    TaskCompletion,
    buildTaskCompletionConfig,
} from './task-completion.entity';
import { SalaryTask } from '@/domains/service/modules/accounting/domain/entities/salary-task/salary-task.entity';
import { CalculationContext } from '@/shared/domain/calculation-context';
import type { ServiceCalculationErpData } from '@/domains/service/modules/accounting/domain/types/calculation-data.types';
import { withRequestContext } from '@/shared/testing/with-request-context';
import { Period } from '@/shared/domain/period.value-object';
import { ArgumentInvalidException } from '@/shared/exceptions';

// replace-bitrix-task-integration, design.md решение 2/4/5 —
// TaskCompletion.create() сохраняет request-only config.taskId в
// config.taskIdByPeriod[текущийПериод] (никакого похода в tasks); calculate()
// — spec service/accounting#requirement-строка-правила-за-выполнение-задачи-появляется-сразу-и-растёт-по-статусу-задачи
// (task-completion-progressive-visibility: null только пока задача периода
// вообще не заведена; иначе PROGNOSE = defaultAmount сразу, FACT = 0 до
// статуса «Выполнена» и далее не откатывается) и
// #requirement-сумма-начисления-по-правилу-за-выполнение-задачи-задаётся-руководителем-вручную
// (requiresManualInput всегда true).
const buildRule = () =>
    withRequestContext(() =>
        TaskCompletion.create({
            type: 'TaskCompletion',
            name: 'Собрать отчёт по браку',
            targetRole: 'ENGINEER',
            config: {
                taskId: 'task-777',
                taskTitleTemplate: 'Собрать отчёт по браку за месяц',
                taskDescriptionTemplate: 'Свериться с журналом брака',
                isRecurring: true,
                deadlineTemplate: '2026-08-05',
                defaultAmount: 5000,
                // add-task-salary-rule-accounting-period — руководитель
                // выбирает период явно, сервер больше не подставляет
                // Period.current() сам.
                accountingPeriod: '2026-08',
            },
        }),
    );

const buildContext = (
    erpData?: ServiceCalculationErpData,
    mode: CalculationContext['mode'] = 'FACT',
): CalculationContext => ({
    employee: {
        id: 1,
        identities: [],
    },
    period: {
        direction: 'service',
        period: '2026-08',
        from: new Date('2026-08-01T00:00:00.000Z'),
        to: new Date('2026-08-31T23:59:59.999Z'),
        status: 'OPEN',
    },
    mode,
    erpData,
    salesPerformance: null,
});

describe('TaskCompletion', () => {
    describe('create', () => {
        it('создаёт правило с генерируемым id и типом TaskCompletion, taskId уходит в taskIdByPeriod под ключом request.accountingPeriod', () => {
            const rule = buildRule();

            expect(rule).toBeInstanceOf(TaskCompletion);
            expect(rule.type).toBe('TaskCompletion');
            expect(rule.id).toEqual(expect.any(String));
            expect(rule.name).toBe('Собрать отчёт по браку');
            expect(rule.targetRole).toBe('ENGINEER');
            // add-task-salary-rule-accounting-period — ключ карты больше не
            // Period.current(), а явно выбранный руководителем период.
            expect(rule.config.taskIdByPeriod).toEqual({
                '2026-08': 'task-777',
            });
            expect(rule.config.accountingPeriod).toBe('2026-08');
            expect(rule.config.taskTitleTemplate).toBe(
                'Собрать отчёт по браку за месяц',
            );
            // taskId — одноразовый вход, не персистируется как отдельное
            // поле config (только через taskIdByPeriod).
            expect(
                (rule.config as unknown as { taskId?: string }).taskId,
            ).toBeUndefined();
        });
    });

    // add-task-salary-rule-accounting-period, design.md Decision 2 —
    // buildTaskCompletionConfig() больше не подставляет Period.current()
    // неявно, а использует явно переданный request.accountingPeriod,
    // провалидированный через Period.create().
    describe('buildTaskCompletionConfig', () => {
        it('кладёт request.taskId в taskIdByPeriod под ключом request.accountingPeriod, а не Period.current()', () => {
            const config = buildTaskCompletionConfig({
                taskId: 'task-1',
                taskTitleTemplate: 'Шаблон',
                isRecurring: false,
                deadlineTemplate: '2026-01-15',
                defaultAmount: 1000,
                accountingPeriod: '2026-11',
            });

            expect(config.taskIdByPeriod).toEqual({ '2026-11': 'task-1' });
            expect(config.accountingPeriod).toBe('2026-11');
        });

        it('сохраняет existingTaskIdByPeriod прошлых периодов, добавляя новый ключ', () => {
            const config = buildTaskCompletionConfig(
                {
                    taskId: 'task-2',
                    taskTitleTemplate: 'Шаблон',
                    isRecurring: true,
                    deadlineTemplate: '2026-01-15',
                    defaultAmount: 1000,
                    accountingPeriod: '2026-12',
                },
                { '2026-11': 'task-1' },
            );

            expect(config.taskIdByPeriod).toEqual({
                '2026-11': 'task-1',
                '2026-12': 'task-2',
            });
            expect(config.accountingPeriod).toBe('2026-12');
        });

        it('бросает исключение домена, а не тихо принимает некорректный формат accountingPeriod', () => {
            withRequestContext(() =>
                expect(() =>
                    buildTaskCompletionConfig({
                        taskId: 'task-1',
                        taskTitleTemplate: 'Шаблон',
                        isRecurring: false,
                        deadlineTemplate: '2026-01-15',
                        defaultAmount: 1000,
                        accountingPeriod: 'не период',
                    }),
                ).toThrow(ArgumentInvalidException),
            );
        });
    });

    describe('calculate', () => {
        it('возвращает null, когда erpData не содержит статус связанной задачи вовсе', () => {
            const rule = buildRule();

            expect(
                rule.calculate(
                    buildContext({
                        serviceCompletedItems: [],
                        hoursWorked: { fact: 0, prognose: 0 },
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
            mode: CalculationContext['mode'],
        ) => {
            const rule = buildRule();
            const line = rule.calculate(
                buildContext(
                    {
                        serviceCompletedItems: [],
                        hoursWorked: { fact: 0, prognose: 0 },
                        taskCompletionStatuses: {
                            [rule.id]: SalaryTask.create({
                                taskId: 'task-777',
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
                expect(fact.line?.requiresManualInput).toBe(true);
            },
        );

        // FR3: FACT становится равен defaultAmount, начиная со статуса
        // «Выполнена», и НЕ откатывается автоматически на более поздних
        // статусах (все достижимы только через DONE).
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
                    id: 'task-777',
                },
            ]);
        });
    });
});
