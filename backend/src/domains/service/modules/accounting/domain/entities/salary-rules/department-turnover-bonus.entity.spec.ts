import { DepartmentTurnoverBonusEntity } from './department-turnover-bonus.entity';
import {
    turnoverPerformanceScopeKey,
    type ServiceCalculationContext,
    type TurnoverPerformanceByScope,
} from '@/domains/service/modules/accounting/domain/types/calculation-context.types';

const buildContext = (
    turnoverPerformance: TurnoverPerformanceByScope,
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
    departmentSalesPerformance: null,
    turnoverPerformance,
    departmentPerformanceOverrides: new Map(),
});

const buildRule = (
    mode: 'FIX' | 'LINEAR',
    overrides: { warehouseId?: number; category?: string | null } = {},
) =>
    DepartmentTurnoverBonusEntity.create({
        type: 'DepartmentTurnoverBonus',
        name: 'Бонус за оборачиваемость склада',
        targetRole: 'DEPARTMENT_HEAD',
        config: {
            warehouseId: overrides.warehouseId ?? 1,
            category: overrides.category ?? null,
            fixedAmount: 100,
            planTurnoverRatio: 1,
            percentBorders: [
                { name: 'A', fromPlanPercent: 50, multiplier: 0.5, mode },
                { name: 'B', fromPlanPercent: 70, multiplier: 1, mode },
                { name: 'C', fromPlanPercent: 100, multiplier: 1.5, mode },
            ],
        },
    });

describe('DepartmentTurnoverBonusEntity', () => {
    describe('create', () => {
        it('создаёт правило с генерируемым id, типом DepartmentTurnoverBonus и ролью DEPARTMENT_HEAD', () => {
            const rule = buildRule('FIX');

            expect(rule.id).toEqual(expect.any(String));
            expect(rule.type).toBe('DepartmentTurnoverBonus');
            expect(rule.targetRole).toBe('DEPARTMENT_HEAD');
        });
    });

    describe('calculate — FR4: amount = round(fixedAmount * resolveFloatPercentMultiplier(percentBorders, resolveTurnoverPercentCompletion(factRatio, planTurnoverRatio)))', () => {
        it('planTurnoverRatio = 1 — factRatio совпадает с процентом выполнения плана (FIX, три порога)', () => {
            const rule = buildRule('FIX', { warehouseId: 1, category: null });
            const key = turnoverPerformanceScopeKey({
                warehouseId: 1,
                category: null,
            });

            // factRatio 0.5/0.7/1.2 при planTurnoverRatio=1 -> percentCompletion 50/70/120.
            const at50 = rule.calculate(
                buildContext(new Map([[key, 0.5]])),
            ).amount;
            const at70 = rule.calculate(
                buildContext(new Map([[key, 0.7]])),
            ).amount;
            const at120 = rule.calculate(
                buildContext(new Map([[key, 1.2]])),
            ).amount;

            expect(at50).toBe(50); // 100 * 0.5
            expect(at70).toBe(100); // 100 * 1
            expect(at120).toBe(150); // 100 * 1.5
        });

        it('LINEAR — множитель пропорционален проценту выполнения плана', () => {
            const rule = buildRule('LINEAR', {
                warehouseId: 1,
                category: null,
            });
            const key = turnoverPerformanceScopeKey({
                warehouseId: 1,
                category: null,
            });

            const at60 = rule.calculate(
                buildContext(new Map([[key, 0.6]])),
            ).amount;

            expect(at60).toBe(30); // 100 * (0.5 * 60/100)
        });

        it('planTurnoverRatio != 1 — процент выполнения плана делится на план', () => {
            const rule = DepartmentTurnoverBonusEntity.create({
                type: 'DepartmentTurnoverBonus',
                name: 'Правило',
                targetRole: 'DEPARTMENT_HEAD',
                config: {
                    warehouseId: 1,
                    category: null,
                    fixedAmount: 100,
                    planTurnoverRatio: 2,
                    percentBorders: [
                        {
                            name: 'A',
                            fromPlanPercent: 50,
                            multiplier: 0.5,
                            mode: 'FIX',
                        },
                        {
                            name: 'B',
                            fromPlanPercent: 70,
                            multiplier: 1,
                            mode: 'FIX',
                        },
                        {
                            name: 'C',
                            fromPlanPercent: 100,
                            multiplier: 1.5,
                            mode: 'FIX',
                        },
                    ],
                },
            });
            const key = turnoverPerformanceScopeKey({
                warehouseId: 1,
                category: null,
            });
            // factRatio=1.4, planRatio=2 -> percentCompletion = 70% -> multiplier 1.
            const line = rule.calculate(buildContext(new Map([[key, 1.4]])));

            expect(line.amount).toBe(100);
        });

        it('резолвит факт по СВОИМ warehouseId+category правила, а не по любому складу', () => {
            const rule = buildRule('FIX', {
                warehouseId: 5,
                category: 'cat-A',
            });
            const scopeKey = turnoverPerformanceScopeKey({
                warehouseId: 5,
                category: 'cat-A',
            });
            const otherKey = turnoverPerformanceScopeKey({
                warehouseId: 5,
                category: null,
            });
            const performance = new Map([
                [otherKey, 0.5], // "весь склад" — должно игнорироваться
                [scopeKey, 1.2], // своя категория
            ]);

            const line = rule.calculate(buildContext(performance));

            expect(line.amount).toBe(150); // взят factRatio своей категории (1.2 -> 120%), не "весь склад"
        });
    });

    describe('calculate — данные для scope не найдены (design.md Q2 — начисляет 0, без ошибки)', () => {
        it('scope отсутствует в карте вовсе', () => {
            const rule = buildRule('FIX');

            const line = rule.calculate(buildContext(new Map()));

            expect(line.amount).toBe(0);
            expect(line.sources).toEqual([]);
        });

        it('scope есть в карте, но значение null (снапшот есть, коэффициент по scope не посчитан)', () => {
            const rule = buildRule('FIX', { warehouseId: 1, category: null });
            const key = turnoverPerformanceScopeKey({
                warehouseId: 1,
                category: null,
            });

            const line = rule.calculate(buildContext(new Map([[key, null]])));

            expect(line.amount).toBe(0);
        });
    });
});
