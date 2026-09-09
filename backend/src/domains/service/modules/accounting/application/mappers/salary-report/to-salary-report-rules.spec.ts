import { buildSalaryReportRules } from './to-salary-report-rules';
import { OrderPayedEntity } from '@/domains/service/modules/accounting/domain/entities/salary-rules/order-payed.entity';
import { PayPerHoursEntity } from '@/domains/service/modules/accounting/domain/entities/salary-rules/pay-per-hour.entity';
import type { PercentBorder } from '@/domains/service/modules/accounting/domain/types/salary-rule.types';
import type { SalesPerformance } from '@/domains/service/modules/sales/domain/value-objects/sales-performance.value-object';

const borders: [PercentBorder, PercentBorder, PercentBorder] = [
    { name: 'A', fromPlanPercent: 50, multiplier: 0.5, mode: 'FIX' },
    { name: 'B', fromPlanPercent: 70, multiplier: 1, mode: 'FIX' },
    { name: 'C', fromPlanPercent: 100, multiplier: 1.5, mode: 'FIX' },
];

const buildFakePerformance = (
    factPercent: number,
    prognosePercent: number,
): SalesPerformance =>
    ({
        getDepartment: () => 1,
        getCategory: () => null,
        getPlan: () => ({ turnover: 100_000 }),
        getFact: () => ({
            getPercentCompletion: () => factPercent,
            getTurnover: () => (factPercent / 100) * 100_000,
        }),
        getPrognose: () => ({
            getPercentCompletion: () => prognosePercent,
            getTurnover: () => (prognosePercent / 100) * 100_000,
        }),
    }) as unknown as SalesPerformance;

describe('buildSalaryReportRules', () => {
    it('для правила, не зависящего от плана (PayPerHour), факт и прогноз равны и appliedPercent не заполнен', () => {
        const rule = PayPerHoursEntity.create({
            type: 'PayPerHour',
            name: 'Почасовая ставка',
            targetRole: 'ENGINEER',
            config: { price: 250 },
        });
        const factLines = [
            {
                ruleId: rule.id,
                quantity: 8,
                rate: 250,
                amount: 2000,
                sources: [],
            },
        ];

        const [entry] = buildSalaryReportRules(
            [rule],
            factLines,
            factLines,
            null,
        );

        expect(entry.amount).toEqual({ fact: 2000, prognose: 2000 });
        expect(entry.appliedPercent).toBeUndefined();
        expect(entry.floatPercent).toBeUndefined();
    });

    it('appliedPercent заполнен для FixedPercent (OrderPayed)', () => {
        const rule = OrderPayedEntity.create({
            type: 'OrderPayed',
            name: 'Процент от выручки',
            targetRole: 'ENGINEER',
            config: {
                award: {
                    type: 'FixedPercent',
                    percent: 10,
                    salaryBasis: 'REVENUE',
                },
            },
        });
        const factLines = [
            {
                ruleId: rule.id,
                salaryBasis: 'REVENUE',
                quantity: 1,
                rate: 10,
                amount: 100,
                sources: [],
            },
        ];

        const [entry] = buildSalaryReportRules(
            [rule],
            factLines,
            factLines,
            null,
        );

        expect(entry.appliedPercent).toBe(10);
    });

    it('FloatPercent — floatPercent.fact/prognose содержат текущий/следующий порог и diffToNext', () => {
        const rule = OrderPayedEntity.create({
            type: 'OrderPayed',
            name: 'Плавающий процент',
            targetRole: 'ENGINEER',
            config: {
                award: {
                    type: 'FloatPercent',
                    basePercent: 10,
                    salaryBasis: 'REVENUE',
                    percentBorders: borders,
                },
            },
        });
        const factLines = [
            {
                ruleId: rule.id,
                salaryBasis: 'REVENUE',
                rate: 5,
                amount: 50,
                sources: [],
            },
        ];
        const prognoseLines = [
            {
                ruleId: rule.id,
                salaryBasis: 'REVENUE',
                rate: 10,
                amount: 100,
                sources: [],
            },
        ];
        // Факт — 65% выполнения плана (порог A/B), прогноз — 70% (порог B).
        const performance = buildFakePerformance(65, 70);

        const [entry] = buildSalaryReportRules(
            [rule],
            factLines,
            prognoseLines,
            performance,
        );

        expect(entry.floatPercent).toBeDefined();
        expect(entry.floatPercent?.fact.currentThreshold).toEqual(borders[0]);
        expect(entry.floatPercent?.fact.nextThreshold).toEqual(borders[1]);
        expect(entry.floatPercent?.fact.diffToNext).toBe(5000); // 70%-65% из 100 000
        expect(entry.floatPercent?.prognose.currentThreshold).toEqual(
            borders[1],
        );
    });

    it('нет SalesPerformance — floatPercent отсутствует, даже если правило FloatPercent', () => {
        const rule = OrderPayedEntity.create({
            type: 'OrderPayed',
            name: 'Плавающий процент',
            targetRole: 'ENGINEER',
            config: {
                award: {
                    type: 'FloatPercent',
                    basePercent: 10,
                    salaryBasis: 'REVENUE',
                    percentBorders: borders,
                },
            },
        });
        const lines = [
            {
                ruleId: rule.id,
                salaryBasis: 'REVENUE',
                rate: 5,
                amount: 50,
                sources: [],
            },
        ];

        const [entry] = buildSalaryReportRules([rule], lines, lines, null);

        expect(entry.floatPercent).toBeUndefined();
    });

    it('itemName источника пробрасывается в sources[] ответа', () => {
        const rule = PayPerHoursEntity.create({
            type: 'PayPerHour',
            name: 'Почасовая ставка',
            targetRole: 'ENGINEER',
            config: { price: 250 },
        });
        const factLines = [
            {
                ruleId: rule.id,
                quantity: 1,
                rate: 100,
                amount: 100,
                sources: [
                    {
                        type: 'serviceOrderItem',
                        id: 1,
                        label: 'А000100',
                        amount: 100,
                        itemName: 'Замена экрана',
                    },
                ],
            },
        ];

        const [entry] = buildSalaryReportRules(
            [rule],
            factLines,
            factLines,
            null,
        );

        expect(entry.sources[0].itemName).toBe('Замена экрана');
    });

    // spec: service/accounting#requirement-правило-за-выполнение-задачи-не-видно-в-прогнозе-до-выполнения
    it('не включает правило, чья строка отсутствует хотя бы в одном из режимов (FACT/PROGNOSE)', () => {
        const ruleA = PayPerHoursEntity.create({
            type: 'PayPerHour',
            name: 'Почасовая ставка',
            targetRole: 'ENGINEER',
            config: { price: 250 },
        });
        const ruleB = OrderPayedEntity.create({
            type: 'OrderPayed',
            name: 'За выполнение задачи (заглушка)',
            targetRole: 'ENGINEER',
            config: { award: { type: 'Fixed', price: 0 } },
        });
        const lineA = {
            ruleId: ruleA.id,
            quantity: 8,
            rate: 250,
            amount: 2000,
            sources: [],
        };
        const lineB = {
            ruleId: ruleB.id,
            amount: 0,
            sources: [],
        };

        // FACT — задача ещё не выполнена (null), PROGNOSE — задача уже
        // выполнена (строка есть): правило не готово ни для одного из
        // режимов отчёта, пока не согласовано и там, и там.
        const entries = buildSalaryReportRules(
            [ruleA, ruleB],
            [lineA, null],
            [lineA, lineB],
            null,
        );

        expect(entries).toHaveLength(1);
        expect(entries[0].ruleId).toBe(ruleA.id);
    });

    it('не включает правило, отсутствующее в обоих режимах сразу', () => {
        const ruleA = PayPerHoursEntity.create({
            type: 'PayPerHour',
            name: 'Почасовая ставка',
            targetRole: 'ENGINEER',
            config: { price: 250 },
        });
        const ruleB = OrderPayedEntity.create({
            type: 'OrderPayed',
            name: 'За выполнение задачи (заглушка)',
            targetRole: 'ENGINEER',
            config: { award: { type: 'Fixed', price: 0 } },
        });
        const lineA = {
            ruleId: ruleA.id,
            quantity: 8,
            rate: 250,
            amount: 2000,
            sources: [],
        };

        const entries = buildSalaryReportRules(
            [ruleA, ruleB],
            [lineA, null],
            [lineA, null],
            null,
        );

        expect(entries).toHaveLength(1);
        expect(entries[0].ruleId).toBe(ruleA.id);
    });

    it('сопоставляет факт/прогноз по ruleId, а не по позиции в отфильтрованных массивах строк', () => {
        const ruleA = PayPerHoursEntity.create({
            type: 'PayPerHour',
            name: 'Почасовая ставка',
            targetRole: 'ENGINEER',
            config: { price: 250 },
        });
        const ruleB = OrderPayedEntity.create({
            type: 'OrderPayed',
            name: 'Правило, готовое только в прогнозе',
            targetRole: 'ENGINEER',
            config: { award: { type: 'Fixed', price: 700 } },
        });
        const ruleC = OrderPayedEntity.create({
            type: 'OrderPayed',
            name: 'Правило, готовое только в факте',
            targetRole: 'ENGINEER',
            config: { award: { type: 'Fixed', price: 300 } },
        });
        const lineA = {
            ruleId: ruleA.id,
            quantity: 8,
            rate: 250,
            amount: 2000,
            sources: [],
        };
        const lineB = { ruleId: ruleB.id, amount: 700, sources: [] };
        const lineC = { ruleId: ruleC.id, amount: 300, sources: [] };

        // ruleB отсутствует в FACT (null), ruleC отсутствует в PROGNOSE
        // (null) — после независимой фильтрации null внутри
        // buildRuleBreakdown позиции factBreakdown[1] (ruleC) и
        // prognoseBreakdown[1] (ruleB) указывали бы на РАЗНЫЕ правила при
        // наивном зипе по индексу; корректно — свести по ruleId и оставить
        // только ruleA, присутствующее в обоих режимах.
        const entries = buildSalaryReportRules(
            [ruleA, ruleB, ruleC],
            [lineA, null, lineC],
            [lineA, lineB, null],
            null,
        );

        expect(entries).toHaveLength(1);
        expect(entries[0].ruleId).toBe(ruleA.id);
        expect(entries[0].amount).toEqual({ fact: 2000, prognose: 2000 });
    });
});
