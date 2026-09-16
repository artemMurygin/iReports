import { DepartmentPlanBonusEntity } from './department-plan-bonus.entity';
import type {
    DepartmentPerformanceOverrideByScope,
    DepartmentSalesPerformanceByCategory,
    ServiceCalculationContext,
} from '@/domains/service/modules/accounting/domain/types/calculation-context.types';

const buildContext = (
    departmentSalesPerformance: DepartmentSalesPerformanceByCategory | null,
    departmentPerformanceOverrides: DepartmentPerformanceOverrideByScope = new Map(),
): ServiceCalculationContext => ({
    employee: { id: 1, identities: [] },
    period: {
        direction: 'service',
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
    departmentPerformanceOverrides,
});

const buildRule = (
    mode: 'FIX' | 'LINEAR',
    category: string | null = null,
    departmentId: number | null = null,
) =>
    DepartmentPlanBonusEntity.create({
        type: 'DepartmentPlanBonus',
        name: 'Бонус за выполнение плана отдела',
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
            departmentId,
        },
    });

const performanceAt = (
    category: string | null,
    percentCompletion: number,
): DepartmentSalesPerformanceByCategory =>
    new Map([
        [category, { fact: { turnover: 0, margin: 0 }, percentCompletion }],
    ]);

describe('DepartmentPlanBonusEntity', () => {
    describe('create', () => {
        it('создаёт правило с генерируемым id, типом DepartmentPlanBonus и ролью DEPARTMENT_HEAD', () => {
            const rule = buildRule('FIX');

            expect(rule.id).toEqual(expect.any(String));
            expect(rule.type).toBe('DepartmentPlanBonus');
            expect(rule.targetRole).toBe('DEPARTMENT_HEAD');
        });
    });

    describe('calculate — FR3: amount = round(fixedAmount * resolveFloatPercentMultiplier(percentBorders, percentCompletion))', () => {
        it('FIX — 50/70/120% выполнения плана дают три разных результата, соответствующих порогам', () => {
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

            expect(at50).toBe(50); // 100 * 0.5
            expect(at70).toBe(100); // 100 * 1
            expect(at120).toBe(150); // 100 * 1.5
        });

        it('LINEAR — множитель пропорционален проценту выполнения плана', () => {
            const rule = buildRule('LINEAR');

            const at60 = rule.calculate(
                buildContext(performanceAt(null, 60)),
            ).amount;

            expect(at60).toBe(30); // 100 * (0.5 * 60/100)
        });

        it('резолвит percentCompletion по СВОЕЙ category правила, а не по отделу целиком', () => {
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

            expect(line.amount).toBe(150); // взят percentCompletion категории cat-A (120%), не отдела (50%)
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

    describe('calculate — departmentId (временный костыль): явное переопределение отдела вместо собственного отдела сотрудника', () => {
        it('резолвит percentCompletion из departmentPerformanceOverrides по (departmentId, category)', () => {
            const rule = buildRule('FIX', null, 158);
            const overrides: DepartmentPerformanceOverrideByScope = new Map([
                ['158:', { fact: { turnover: 0, margin: 0 }, percentCompletion: 120 }],
            ]);

            // departmentSalesPerformance (собственный отдел) намеренно не несёт этот ключ —
            // правило с departmentId не должно к нему обращаться.
            const line = rule.calculate(buildContext(null, overrides));

            expect(line.amount).toBe(150); // 100 * 1.5
        });

        it('scope отсутствует в overrides — начисляет 0, даже если у отдела сотрудника есть план', () => {
            const rule = buildRule('FIX', null, 158);

            const line = rule.calculate(
                buildContext(performanceAt(null, 120), new Map()),
            );

            expect(line.amount).toBe(0);
        });
    });
});
