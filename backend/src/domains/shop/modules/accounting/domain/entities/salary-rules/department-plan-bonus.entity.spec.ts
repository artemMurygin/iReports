import { DepartmentPlanBonusEntity } from './department-plan-bonus.entity';
import type {
    DepartmentSalesPerformanceByCategory,
    ShopDepartmentCalculationContext,
} from '../../types/calculation-context.types';

const buildContext = (
    departmentSalesPerformance: DepartmentSalesPerformanceByCategory | null,
): ShopDepartmentCalculationContext => ({
    employee: { id: 1, identities: [] },
    period: {
        direction: 'shop',
        period: '2026-08',
        from: new Date('2026-08-01T00:00:00.000Z'),
        to: new Date('2026-08-31T23:59:59.999Z'),
        status: 'OPEN',
    },
    mode: 'FACT',
    erpData: undefined,
    salesPerformance: null,
    departmentSalesPerformance,
    turnoverPerformance: new Map(),
});

const buildRule = (mode: 'FIX' | 'LINEAR', category: string | null = null) =>
    DepartmentPlanBonusEntity.create({
        type: 'DepartmentPlanBonus',
        name: 'Бонус за выполнение плана магазина',
        targetRole: 'DEPARTMENT_HEAD',
        config: {
            salaryBasis: 'REVENUE',
            category,
            fixedAmount: 100,
            percentBorders: [
                { name: 'A', fromPlanPercent: 50, multiplier: 0.5, mode },
                { name: 'B', fromPlanPercent: 70, multiplier: 1, mode },
                { name: 'C', fromPlanPercent: 100, multiplier: 1.5, mode },
            ],
        },
    });

const performanceAt = (
    category: string | null,
    percentCompletion: number,
): DepartmentSalesPerformanceByCategory =>
    new Map([
        [category, { fact: { turnover: 0, margin: 0 }, percentCompletion }],
    ]);

describe('DepartmentPlanBonusEntity (shop)', () => {
    describe('create', () => {
        it('создаёт правило с генерируемым id, типом DepartmentPlanBonus и ролью DEPARTMENT_HEAD', () => {
            const rule = buildRule('FIX');

            expect(rule.id).toEqual(expect.any(String));
            expect(rule.type).toBe('DepartmentPlanBonus');
            expect(rule.targetRole).toBe('DEPARTMENT_HEAD');
        });
    });

    describe('calculate — FR3: amount = round(fixedAmount * multiplier(percentCompletion))', () => {
        it('FIX — 50/70/120% выполнения плана дают три разных результата', () => {
            const rule = buildRule('FIX');

            const at50 = rule.calculate(
                buildContext(performanceAt(null, 50)),
            ).amount;
            const at70 = rule.calculate(
                buildContext(performanceAt(null, 70)),
            ).amount;
            const at120 = rule.calculate(
                buildContext(performanceAt(null, 120)),
            ).amount;

            expect(at50).toBe(50);
            expect(at70).toBe(100);
            expect(at120).toBe(150);
        });

        it('LINEAR — интерполирует между порогами', () => {
            const rule = buildRule('LINEAR');

            const at60 = rule.calculate(
                buildContext(performanceAt(null, 60)),
            ).amount;

            expect(at60).toBe(75);
        });

        it('резолвит percentCompletion по СВОЕЙ category правила', () => {
            const rule = buildRule('FIX', 'cat-A');
            const performance: DepartmentSalesPerformanceByCategory = new Map([
                [
                    null,
                    { fact: { turnover: 0, margin: 0 }, percentCompletion: 50 },
                ],
                [
                    'cat-A',
                    {
                        fact: { turnover: 0, margin: 0 },
                        percentCompletion: 120,
                    },
                ],
            ]);

            const line = rule.calculate(buildContext(performance));

            expect(line.amount).toBe(150);
        });
    });

    describe('calculate — данные для scope не найдены (design.md Q2 — начисляет 0, без ошибки)', () => {
        it('карта равна null', () => {
            const rule = buildRule('FIX');

            const line = rule.calculate(buildContext(null));

            expect(line.amount).toBe(0);
            expect(line.sources).toEqual([]);
        });

        it('category правила отсутствует в карте', () => {
            const rule = buildRule('FIX', 'cat-missing');

            const line = rule.calculate(buildContext(performanceAt(null, 100)));

            expect(line.amount).toBe(0);
        });
    });
});
