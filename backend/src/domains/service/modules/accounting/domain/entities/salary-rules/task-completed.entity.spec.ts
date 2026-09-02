import { TaskCompletedEntity } from './task-completed.entity';
import { CalculationContext } from '@/shared/domain/calculation-context';
import type {
    BitrixTaskRuleStatusItem,
    ServiceCalculationErpData,
} from '@/domains/service/modules/accounting/domain/types/service-calculation-data.types';
import { ArgumentInvalidException } from '@/shared/exceptions';
import { withRequestContext } from '@/shared/testing/with-request-context';

const REPORT_PERIOD = '2026-08';

const buildRule = (overrides: Partial<{ rewardAmount: number }> = {}) =>
    TaskCompletedEntity.create({
        type: 'TaskCompleted',
        name: 'За задачу',
        targetRole: 'ENGINEER',
        config: {
            description: 'Сделать что-то важное',
            period: REPORT_PERIOD,
            isRecurring: false,
            dueDate: `${REPORT_PERIOD}-15`,
            rewardAmount: overrides.rewardAmount ?? 10000,
        },
    });

const buildContext = (
    mode: CalculationContext['mode'],
    bitrixTaskStatuses: BitrixTaskRuleStatusItem[],
): CalculationContext => ({
    employee: { id: 1, identities: [] },
    period: {
        direction: 'service',
        period: REPORT_PERIOD,
        from: new Date('2026-08-01T00:00:00.000Z'),
        to: new Date('2026-08-31T23:59:59.999Z'),
        status: 'OPEN',
    },
    mode,
    erpData: {
        serviceCompletedItems: [],
        hoursWorked: { fact: 0, prognose: 0 },
        orderPayedItems: [],
        bitrixTaskStatuses,
    } satisfies ServiceCalculationErpData,
    salesPerformance: null,
});

describe('TaskCompletedEntity', () => {
    describe('расчёт факта и прогноза по статусу задачи Bitrix24', () => {
        it('задача в работе (Создана) учитывается только в прогнозе', () => {
            const rule = buildRule();
            rule.addBitrixTaskId(101);
            const statuses: BitrixTaskRuleStatusItem[] = [
                {
                    id: 101,
                    isAvailable: true,
                    status: 'PENDING',
                    period: REPORT_PERIOD,
                },
            ];

            const fact = rule.calculate(buildContext('FACT', statuses));
            const prognose = rule.calculate(buildContext('PROGNOSE', statuses));

            expect(fact.amount).toBe(0);
            expect(prognose.amount).toBe(10000);
        });

        it('задача в работе (Реализована) учитывается только в прогнозе', () => {
            const rule = buildRule();
            rule.addBitrixTaskId(101);
            const statuses: BitrixTaskRuleStatusItem[] = [
                {
                    id: 101,
                    isAvailable: true,
                    status: 'IN_PROGRESS',
                    period: REPORT_PERIOD,
                },
            ];

            const fact = rule.calculate(buildContext('FACT', statuses));
            const prognose = rule.calculate(buildContext('PROGNOSE', statuses));

            expect(fact.amount).toBe(0);
            expect(prognose.amount).toBe(10000);
        });

        it('закрытая задача без фактической суммы даёт полную сумму в факте и в прогнозе', () => {
            const rule = buildRule();
            rule.addBitrixTaskId(101);
            const statuses: BitrixTaskRuleStatusItem[] = [
                {
                    id: 101,
                    isAvailable: true,
                    status: 'COMPLETED',
                    period: REPORT_PERIOD,
                },
            ];

            const fact = rule.calculate(buildContext('FACT', statuses));
            const prognose = rule.calculate(buildContext('PROGNOSE', statuses));

            expect(fact.amount).toBe(10000);
            expect(prognose.amount).toBe(10000);
        });

        it('закрытая задача с фактической суммой 3000 при сумме правила 10000 даёт 3000 в факте и 10000 в прогнозе', () => {
            const rule = buildRule({ rewardAmount: 10000 });
            rule.addBitrixTaskId(101);
            rule.upsertActualAmount(REPORT_PERIOD, 3000);
            const statuses: BitrixTaskRuleStatusItem[] = [
                {
                    id: 101,
                    isAvailable: true,
                    status: 'COMPLETED',
                    period: REPORT_PERIOD,
                },
            ];

            const fact = rule.calculate(buildContext('FACT', statuses));
            const prognose = rule.calculate(buildContext('PROGNOSE', statuses));

            expect(fact.amount).toBe(3000);
            expect(prognose.amount).toBe(10000);
        });

        it('регулярное правило с несколькими накопленными задачами применяет ту, чей месяц совпадает с отчётным периодом', () => {
            const rule = buildRule();
            rule.addBitrixTaskId(100); // задача прошлого месяца, уже закрыта
            rule.addBitrixTaskId(101); // задача текущего отчётного месяца
            const statuses: BitrixTaskRuleStatusItem[] = [
                {
                    id: 100,
                    isAvailable: true,
                    status: 'COMPLETED',
                    period: '2026-07',
                },
                {
                    id: 101,
                    isAvailable: true,
                    status: 'COMPLETED',
                    period: REPORT_PERIOD,
                },
            ];

            const fact = rule.calculate(buildContext('FACT', statuses));

            expect(fact.amount).toBe(10000);
            expect(fact.sources).toEqual([
                { type: 'bitrixTask', id: 101, amount: 10000 },
            ]);
        });

        it('задача, перенесённая на другой месяц, не даёт начисления в этом периоде и не помечается недоступной', () => {
            const rule = buildRule();
            rule.addBitrixTaskId(101);
            const statuses: BitrixTaskRuleStatusItem[] = [
                {
                    id: 101,
                    isAvailable: true,
                    status: 'PENDING',
                    period: '2026-09',
                },
            ];

            const fact = rule.calculate(buildContext('FACT', statuses));
            const prognose = rule.calculate(buildContext('PROGNOSE', statuses));

            expect(fact.amount).toBe(0);
            expect(prognose.amount).toBe(0);
            expect(fact.isUnavailable).toBe(false);
            expect(prognose.isUnavailable).toBe(false);
        });
    });

    describe('обработка недоступной задачи', () => {
        it('удалённая/недоступная задача не даёт начисления ни в факте, ни в прогнозе', () => {
            const rule = buildRule();
            rule.addBitrixTaskId(101);
            const statuses: BitrixTaskRuleStatusItem[] = [
                { id: 101, isAvailable: false, status: null, period: null },
            ];

            const fact = rule.calculate(buildContext('FACT', statuses));
            const prognose = rule.calculate(buildContext('PROGNOSE', statuses));

            expect(fact.amount).toBe(0);
            expect(prognose.amount).toBe(0);
            expect(fact.isUnavailable).toBe(true);
            expect(prognose.isUnavailable).toBe(true);
        });

        it('нераспознанный/отсутствующий тег расчётного месяца трактуется как недоступность', () => {
            const rule = buildRule();
            rule.addBitrixTaskId(101);
            const statuses: BitrixTaskRuleStatusItem[] = [
                { id: 101, isAvailable: true, status: 'PENDING', period: null },
            ];

            const line = rule.calculate(buildContext('FACT', statuses));

            expect(line.amount).toBe(0);
            expect(line.isUnavailable).toBe(true);
        });

        it('правило без ни одной задачи в batch-ответе тоже трактуется как недоступное', () => {
            const rule = buildRule();
            rule.addBitrixTaskId(101);

            const line = rule.calculate(buildContext('FACT', []));

            expect(line.amount).toBe(0);
            expect(line.isUnavailable).toBe(true);
        });
    });

    describe('вознаграждение — только фиксированная сумма (value object)', () => {
        it('отклоняет отрицательную сумму вознаграждения', () => {
            withRequestContext(() => {
                expect(() => buildRule({ rewardAmount: -100 })).toThrow(
                    ArgumentInvalidException,
                );
            });
        });
    });

    describe('bitrixTaskIds', () => {
        it('по умолчанию пустой список', () => {
            const rule = buildRule();

            expect(rule.bitrixTaskIds).toEqual([]);
        });

        it('addBitrixTaskId добавляет ID, не заменяя уже накопленные', () => {
            const rule = buildRule();

            rule.addBitrixTaskId(101);
            rule.addBitrixTaskId(102);

            expect(rule.bitrixTaskIds).toEqual([101, 102]);
        });
    });

    describe('actualAmounts (upsertActualAmount)', () => {
        it('добавляет новую запись, если периода ещё нет', () => {
            const rule = buildRule();

            rule.upsertActualAmount('2026-08', 3000);

            expect(rule.actualAmounts).toEqual([
                { period: '2026-08', amount: 3000 },
            ]);
        });

        it('обновляет уже существующую запись того же периода, не дублируя её', () => {
            const rule = buildRule();

            rule.upsertActualAmount('2026-08', 3000);
            rule.upsertActualAmount('2026-09', 1000);
            rule.upsertActualAmount('2026-08', 5000);

            expect(rule.actualAmounts).toEqual([
                { period: '2026-08', amount: 5000 },
                { period: '2026-09', amount: 1000 },
            ]);
        });
    });
});
