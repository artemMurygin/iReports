import { TaskCompletionShop } from './task-completion.entity';
import { ShopTaskStatus } from '@/domains/shop/modules/accounting/domain/value-objects/task-status.value-object';
import { buildBitrixTaskLink } from '@/integrations/bitrix/bitrix-task-link-builder';
import type { ShopCalculationContext } from '@/domains/shop/modules/accounting/domain/types/calculation-context.types';
import type { ShopCalculationErpData } from '@/domains/shop/modules/accounting/domain/types/calculation-data.types';

// Раздел 15 tasks.md (add-task-based-salary-rule) — зеркало раздела 10
// (domains/service/modules/accounting/domain/entities/salary-rules/
// task-completion.entity.spec.ts), независимая копия для направления shop
// (issue #57): TaskCompletionShop.calculate() —
// spec shop/accounting#requirement-правило-за-выполнение-задачи-не-видно-в-прогнозе-до-выполнения
// (строка отсутствует в отчёте, пока задача не выполнена) и
// #requirement-сумма-начисления-по-правилу-за-выполнение-задачи-задаётся-руководителем-вручную
// (amount всегда равен config.defaultAmount — сумме по умолчанию, заданной
// при создании правила; requiresManualInput всегда true, руководитель может
// изменить сумму и обязан указать комментарий при проведении, design.md
// Decision 5).
const buildRule = () =>
    TaskCompletionShop.create({
        type: 'TaskCompletion',
        name: 'Сверить остатки склада',
        targetRole: 'ONLINE_MANAGER',
        config: {
            bitrixTaskTitle: 'Сверить остатки склада за месяц',
            taskDescription: 'Свериться с МойСклад',
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
    // buildBitrixTaskLink (раздел 7, общая инфраструктура) читает портал из
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

            expect(rule).toBeInstanceOf(TaskCompletionShop);
            expect(rule.type).toBe('TaskCompletion');
            expect(rule.id).toEqual(expect.any(String));
            expect(rule.name).toBe('Сверить остатки склада');
            expect(rule.targetRole).toBe('ONLINE_MANAGER');
            expect(rule.config.bitrixTaskTitle).toBe(
                'Сверить остатки склада за месяц',
            );
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

        it('возвращает null, когда статус связанной задачи не Done', () => {
            const rule = buildRule();

            const line = rule.calculate(
                buildContext({
                    productSoldItems: [],
                    taskCompletionStatuses: {
                        [rule.id]: {
                            bitrixTaskId: '4821',
                            status: ShopTaskStatus.fromRaw('2'), // "Новая", не Done
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
                    productSoldItems: [],
                    taskCompletionStatuses: {
                        [rule.id]: {
                            bitrixTaskId: '4821',
                            status: ShopTaskStatus.fromRaw('5'), // "Завершена"
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
                    label: 'Сверить остатки склада за месяц',
                    link: buildBitrixTaskLink('4821'),
                },
            ]);
        });

        // Раздел 10.1/15.1 — amount/requiresManualInput не зависят от того,
        // была ли уже когда-то введена сумма в документе начисления: сумма
        // живёт только на ShopSalaryAccrualLine (design.md Decision 5),
        // calculate() её не читает и не пересчитывает вовсе — статус Done
        // всегда даёт один и тот же результат (config.defaultAmount/true),
        // независимо от количества прошлых вызовов.
        it('всегда возвращает amount из config.defaultAmount и requiresManualInput true при повторных вызовах со статусом Done', () => {
            const rule = buildRule();
            const context = buildContext({
                productSoldItems: [],
                taskCompletionStatuses: {
                    [rule.id]: {
                        bitrixTaskId: '4821',
                        status: ShopTaskStatus.fromRaw('5'),
                    },
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
