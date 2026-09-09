import { TaskCompletion } from './task-completion.entity';
import { TaskStatus } from '@/domains/service/modules/accounting/domain/value-objects/task-status.value-object';
import { buildBitrixTaskLink } from '@/integrations/bitrix/bitrix-task-link-builder';
import { CalculationContext } from '@/shared/domain/calculation-context';
import type { ServiceCalculationErpData } from '@/domains/service/modules/accounting/domain/types/calculation-data.types';

// Раздел 10 tasks.md (add-task-based-salary-rule): TaskCompletion.calculate()
// — spec service/accounting#requirement-правило-за-выполнение-задачи-не-видно-в-прогнозе-до-выполнения
// (строка отсутствует в отчёте, пока задача не выполнена) и
// #requirement-сумма-начисления-по-правилу-за-выполнение-задачи-задаётся-руководителем-вручную
// (amount всегда равен config.defaultAmount — сумме по умолчанию, заданной
// при создании правила; requiresManualInput всегда true, руководитель может
// изменить сумму и обязан указать комментарий при проведении, design.md
// Decision 5).
const buildRule = () =>
    TaskCompletion.create({
        type: 'TaskCompletion',
        name: 'Собрать отчёт по браку',
        targetRole: 'ENGINEER',
        config: {
            bitrixTaskTitle: 'Собрать отчёт по браку за месяц',
            taskDescription: 'Свериться с журналом брака',
            isRecurring: true,
            deadlineTemplate: '2026-08-05',
            defaultAmount: 5000,
        },
    });

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
    // buildBitrixTaskLink (раздел 7) читает портал из
    // process.env.BITRIX24_WEBHOOK_URL — jest не подгружает .env
    // автоматически для юнит-тестов (см. bitrix-task-link-builder.spec.ts),
    // выставляем/чистим сами.
    const originalWebhookUrl = process.env.BITRIX24_WEBHOOK_URL;

    beforeEach(() => {
        process.env.BITRIX24_WEBHOOK_URL =
            'https://irepair.bitrix24.ru/rest/12/8b659pktudu7xlqu/';
    });

    afterEach(() => {
        if (originalWebhookUrl === undefined) {
            delete process.env.BITRIX24_WEBHOOK_URL;
        } else {
            process.env.BITRIX24_WEBHOOK_URL = originalWebhookUrl;
        }
    });

    describe('create', () => {
        it('создаёт правило с генерируемым id и типом TaskCompletion', () => {
            const rule = buildRule();

            expect(rule).toBeInstanceOf(TaskCompletion);
            expect(rule.type).toBe('TaskCompletion');
            expect(rule.id).toEqual(expect.any(String));
            expect(rule.name).toBe('Собрать отчёт по браку');
            expect(rule.targetRole).toBe('ENGINEER');
            expect(rule.config.bitrixTaskTitle).toBe(
                'Собрать отчёт по браку за месяц',
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

        it('возвращает null, когда статус связанной задачи не Done', () => {
            const rule = buildRule();

            const line = rule.calculate(
                buildContext({
                    serviceCompletedItems: [],
                    hoursWorked: { fact: 0, prognose: 0 },
                    taskCompletionStatuses: {
                        [rule.id]: {
                            bitrixTaskId: '4821',
                            status: TaskStatus.fromRaw('2'), // "Новая", не Done
                        },
                    },
                }),
            );

            expect(line).toBeNull();
        });

        it('возвращает CalculationLine с amount из config.defaultAmount и requiresManualInput true, когда статус Done', () => {
            const rule = buildRule();

            const line = rule.calculate(
                buildContext({
                    serviceCompletedItems: [],
                    hoursWorked: { fact: 0, prognose: 0 },
                    taskCompletionStatuses: {
                        [rule.id]: {
                            bitrixTaskId: '4821',
                            status: TaskStatus.fromRaw('5'), // "Завершена"
                        },
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
                    id: '4821',
                    label: 'Собрать отчёт по браку за месяц',
                    link: buildBitrixTaskLink('4821'),
                },
            ]);
        });
    });
});
