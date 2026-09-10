import {
    shopSalaryRuleRequestSchema,
    targetRoleSchema,
} from 'ireports-contracts';

// Контрактные тесты `contracts/commands/shop-salary-rule.ts` (shop) — зеркало
// salary-rule.contract.spec.ts (service), независимый discriminated union (issue #57/#60: shop и
// service не смешивают контракты). Задача 1.1 openspec/changes/add-department-head-salary-rules/tasks.md.

const percentBorders = [
    {
        name: 'below',
        fromPlanPercent: 0,
        multiplier: 0.5,
        mode: 'FIX' as const,
    },
    {
        name: 'target',
        fromPlanPercent: 100,
        multiplier: 1,
        mode: 'FIX' as const,
    },
    {
        name: 'above',
        fromPlanPercent: 120,
        multiplier: 1.2,
        mode: 'LINEAR' as const,
    },
];

describe('targetRoleSchema — общий с service (FR1)', () => {
    // FR1: роль «Руководитель направления» применяется симметрично к обоим направлениям —
    // shop переиспользует общий targetRoleSchema из salary-rule.ts напрямую.
    it('принимает новый литерал роли DEPARTMENT_HEAD', () => {
        const result = targetRoleSchema.safeParse('DEPARTMENT_HEAD');
        expect(result.success).toBe(true);
    });
});

describe('shopSalaryRuleRequestSchema — DepartmentPercent (FR2, shop)', () => {
    // FR2: та же формула, что у service, но shopSalaryBasisSchema (REVENUE/MARGIN, без
    // SALARY_MINUS_ENGINEER_SALARY — в магазине нет роли инженера).
    it('принимает валидное правило DepartmentPercent с category = null', () => {
        const result = shopSalaryRuleRequestSchema.safeParse({
            type: 'DepartmentPercent',
            name: 'Процент от выручки магазина',
            targetRole: 'DEPARTMENT_HEAD',
            config: {
                salaryBasis: 'REVENUE',
                category: null,
                percent: 3,
            },
        });
        expect(result.success).toBe(true);
    });

    // FR2: shop не знает SALARY_MINUS_ENGINEER_SALARY — базис из сервисного enum'а невалиден.
    it('отклоняет DepartmentPercent с salaryBasis = SALARY_MINUS_ENGINEER_SALARY (сервисный enum)', () => {
        const result = shopSalaryRuleRequestSchema.safeParse({
            type: 'DepartmentPercent',
            name: 'Недопустимый базис',
            targetRole: 'DEPARTMENT_HEAD',
            config: {
                salaryBasis: 'SALARY_MINUS_ENGINEER_SALARY',
                category: null,
                percent: 3,
            },
        });
        expect(result.success).toBe(false);
    });
});

describe('shopSalaryRuleRequestSchema — DepartmentPlanBonus (FR3, shop)', () => {
    it('принимает валидное правило DepartmentPlanBonus с percentBorders', () => {
        const result = shopSalaryRuleRequestSchema.safeParse({
            type: 'DepartmentPlanBonus',
            name: 'Бонус за план продаж магазина',
            targetRole: 'DEPARTMENT_HEAD',
            config: {
                salaryBasis: 'MARGIN',
                category: null,
                fixedAmount: 25000,
                percentBorders,
            },
        });
        expect(result.success).toBe(true);
    });

    it('отклоняет DepartmentPlanBonus без fixedAmount', () => {
        const result = shopSalaryRuleRequestSchema.safeParse({
            type: 'DepartmentPlanBonus',
            name: 'Без суммы',
            targetRole: 'DEPARTMENT_HEAD',
            config: {
                salaryBasis: 'MARGIN',
                category: null,
                percentBorders,
            },
        });
        expect(result.success).toBe(false);
    });
});

describe('shopSalaryRuleRequestSchema — DepartmentTurnoverBonus (FR4, shop)', () => {
    // FR4: warehouseId направления shop — строковый MoySklad-склад (в отличие от числового
    // service), как в shopGoodsTurnoverReportLineSchema.warehouseId.
    it('принимает валидное правило DepartmentTurnoverBonus со строковым warehouseId', () => {
        const result = shopSalaryRuleRequestSchema.safeParse({
            type: 'DepartmentTurnoverBonus',
            name: 'Бонус за оборачиваемость склада магазина',
            targetRole: 'DEPARTMENT_HEAD',
            config: {
                warehouseId: 'moysklad-warehouse-uuid',
                category: null,
                fixedAmount: 18000,
                planTurnoverRatio: 1.2,
                percentBorders,
            },
        });
        expect(result.success).toBe(true);
    });

    it('отклоняет DepartmentTurnoverBonus без обязательного warehouseId', () => {
        const result = shopSalaryRuleRequestSchema.safeParse({
            type: 'DepartmentTurnoverBonus',
            name: 'Без склада',
            targetRole: 'DEPARTMENT_HEAD',
            config: {
                category: null,
                fixedAmount: 18000,
                planTurnoverRatio: 1.2,
                percentBorders,
            },
        });
        expect(result.success).toBe(false);
    });

    it('отклоняет DepartmentTurnoverBonus с числовым warehouseId (сервисный формат)', () => {
        const result = shopSalaryRuleRequestSchema.safeParse({
            type: 'DepartmentTurnoverBonus',
            name: 'Числовой склад',
            targetRole: 'DEPARTMENT_HEAD',
            config: {
                warehouseId: 42,
                category: null,
                fixedAmount: 18000,
                planTurnoverRatio: 1.2,
                percentBorders,
            },
        });
        expect(result.success).toBe(false);
    });
});

describe('shopSalaryRuleRequestSchema — регрессия существующих 4 видов правил', () => {
    it('по-прежнему принимает существующее правило ProductSold', () => {
        const result = shopSalaryRuleRequestSchema.safeParse({
            type: 'ProductSold',
            name: 'За проданный товар',
            targetRole: 'ONLINE_MANAGER',
            config: {
                category: null,
                award: { type: 'Fixed', price: 100 },
            },
        });
        expect(result.success).toBe(true);
    });
});
