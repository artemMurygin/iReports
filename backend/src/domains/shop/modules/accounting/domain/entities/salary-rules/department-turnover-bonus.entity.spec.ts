import { DepartmentTurnoverBonusEntity } from './department-turnover-bonus.entity';
import {
    turnoverPerformanceScopeKey,
    type ShopDepartmentCalculationContext,
    type TurnoverPerformanceByScope,
} from '../../types/calculation-context.types';

const buildContext = (
    turnoverPerformance: TurnoverPerformanceByScope,
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
    departmentSalesPerformance: null,
    turnoverPerformance,
});

const buildRule = (
    mode: 'FIX' | 'LINEAR',
    overrides: { warehouseId?: string; category?: string | null } = {},
) =>
    DepartmentTurnoverBonusEntity.create({
        type: 'DepartmentTurnoverBonus',
        name: 'Бонус за оборачиваемость склада',
        targetRole: 'DEPARTMENT_HEAD',
        config: {
            warehouseId: overrides.warehouseId ?? 'wh-1',
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

describe('DepartmentTurnoverBonusEntity (shop)', () => {
    describe('create', () => {
        it('создаёт правило с генерируемым id, типом DepartmentTurnoverBonus и ролью DEPARTMENT_HEAD', () => {
            const rule = buildRule('FIX');

            expect(rule.id).toEqual(expect.any(String));
            expect(rule.type).toBe('DepartmentTurnoverBonus');
            expect(rule.targetRole).toBe('DEPARTMENT_HEAD');
        });
    });

    describe('calculate — FR4: amount = round(fixedAmount * multiplier(resolveTurnoverPercentCompletion(factRatio, planTurnoverRatio)))', () => {
        it('planTurnoverRatio = 1 — factRatio совпадает с процентом выполнения плана (FIX, три порога)', () => {
            const rule = buildRule('FIX', {
                warehouseId: 'wh-1',
                category: null,
            });
            const key = turnoverPerformanceScopeKey({
                warehouseId: 'wh-1',
                category: null,
            });

            const at50 = rule.calculate(
                buildContext(new Map([[key, 0.5]])),
            ).amount;
            const at70 = rule.calculate(
                buildContext(new Map([[key, 0.7]])),
            ).amount;
            const at120 = rule.calculate(
                buildContext(new Map([[key, 1.2]])),
            ).amount;

            expect(at50).toBe(50);
            expect(at70).toBe(100);
            expect(at120).toBe(150);
        });

        it('LINEAR — интерполирует между порогами', () => {
            const rule = buildRule('LINEAR', {
                warehouseId: 'wh-1',
                category: null,
            });
            const key = turnoverPerformanceScopeKey({
                warehouseId: 'wh-1',
                category: null,
            });

            const at60 = rule.calculate(
                buildContext(new Map([[key, 0.6]])),
            ).amount;

            expect(at60).toBe(75);
        });

        it('резолвит факт по СВОИМ warehouseId+category правила', () => {
            const rule = buildRule('FIX', {
                warehouseId: 'wh-5',
                category: 'cat-A',
            });
            const scopeKey = turnoverPerformanceScopeKey({
                warehouseId: 'wh-5',
                category: 'cat-A',
            });
            const otherKey = turnoverPerformanceScopeKey({
                warehouseId: 'wh-5',
                category: null,
            });
            const performance = new Map([
                [otherKey, 0.5],
                [scopeKey, 1.2],
            ]);

            const line = rule.calculate(buildContext(performance));

            expect(line.amount).toBe(150);
        });
    });

    describe('calculate — данные для scope не найдены (design.md Q2 — начисляет 0, без ошибки)', () => {
        it('scope отсутствует в карте вовсе', () => {
            const rule = buildRule('FIX');

            const line = rule.calculate(buildContext(new Map()));

            expect(line.amount).toBe(0);
            expect(line.sources).toEqual([]);
        });

        it('scope есть в карте, но значение null', () => {
            const rule = buildRule('FIX', {
                warehouseId: 'wh-1',
                category: null,
            });
            const key = turnoverPerformanceScopeKey({
                warehouseId: 'wh-1',
                category: null,
            });

            const line = rule.calculate(buildContext(new Map([[key, null]])));

            expect(line.amount).toBe(0);
        });
    });
});
