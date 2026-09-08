import { TaskCompletion } from './task-completion.entity';
import { SalaryTask } from '@/domains/service/modules/accounting/domain/entities/salary-task/salary-task.entity';
import { CalculationContext } from '@/shared/domain/calculation-context';
import type { ServiceCalculationErpData } from '@/domains/service/modules/accounting/domain/types/calculation-data.types';
import { withRequestContext } from '@/shared/testing/with-request-context';
import { Period } from '@/shared/domain/period.value-object';

// replace-bitrix-task-integration, design.md решение 2/4/5 —
// TaskCompletion.create() сохраняет request-only config.taskId в
// config.taskIdByPeriod[текущийПериод] (никакого похода в tasks); calculate()
// — spec service/accounting#requirement-правило-за-выполнение-задачи-не-видно-в-прогнозе-до-выполнения
// (строка отсутствует, пока связанная SalaryTask.isCompleted() не true —
// код 'CLOSED_SUCCESSFULLY', не любой другой/терминальный статус) и
// #requirement-сумма-начисления-по-правилу-за-выполнение-задачи-задаётся-руководителем-вручную
// (amount всегда равен config.defaultAmount, requiresManualInput всегда
// true).
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
            },
        }),
    );

const buildContext = (
    erpData?: ServiceCalculationErpData,
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
    mode: 'FACT',
    erpData,
    salesPerformance: null,
});

describe('TaskCompletion', () => {
    describe('create', () => {
        it('создаёт правило с генерируемым id и типом TaskCompletion, taskId уходит в taskIdByPeriod текущего периода', () => {
            const rule = buildRule();

            expect(rule).toBeInstanceOf(TaskCompletion);
            expect(rule.type).toBe('TaskCompletion');
            expect(rule.id).toEqual(expect.any(String));
            expect(rule.name).toBe('Собрать отчёт по браку');
            expect(rule.targetRole).toBe('ENGINEER');
            expect(rule.config.taskIdByPeriod).toEqual({
                [Period.current().getValue()]: 'task-777',
            });
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

        it.each([
            'NEW',
            'IN_PROGRESS',
            'DONE',
            'REWORK',
            'CLOSED_UNSUCCESSFULLY',
        ])(
            'возвращает null, когда SalaryTask.isCompleted() — false (статус %s)',
            (status) => {
                const rule = buildRule();

                const line = rule.calculate(
                    buildContext({
                        serviceCompletedItems: [],
                        hoursWorked: { fact: 0, prognose: 0 },
                        taskCompletionStatuses: {
                            [rule.id]: SalaryTask.create({
                                taskId: 'task-777',
                                status,
                            }),
                        },
                    }),
                );

                expect(line).toBeNull();
            },
        );

        it('возвращает CalculationLine с amount из config.defaultAmount и requiresManualInput true, когда SalaryTask.isCompleted()', () => {
            const rule = buildRule();

            const line = rule.calculate(
                buildContext({
                    serviceCompletedItems: [],
                    hoursWorked: { fact: 0, prognose: 0 },
                    taskCompletionStatuses: {
                        [rule.id]: SalaryTask.create({
                            taskId: 'task-777',
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
                    id: 'task-777',
                },
            ]);
        });
    });
});
