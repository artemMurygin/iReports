import { salaryRuleRequestSchema, targetRoleSchema } from 'ireports-contracts';

// Контрактные тесты `contracts/commands/salary-rule.ts` (service) — проверяют форму zod-схем
// напрямую, без прохождения через backend-домен (тот же приём, что и остальные *.dto.ts
// потребители этой схемы, но здесь схема тестируется как таковая, а не как часть контроллера).
// Задача 1.1 openspec/changes/add-department-head-salary-rules/tasks.md.

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

describe('salaryRuleRequestSchema — новая роль «Руководитель направления» (FR1)', () => {
    // FR1: новая мотивационная роль назначается через уже существующий targetType = 'Employee',
    // без нового role-source — здесь проверяется только сам литерал targetRoleSchema.
    it('принимает новый литерал роли DEPARTMENT_HEAD', () => {
        const result = targetRoleSchema.safeParse('DEPARTMENT_HEAD');
        expect(result.success).toBe(true);
    });

    // FR1: регрессия — существующие роли не должны быть задеты добавлением нового литерала.
    it('по-прежнему принимает существующую роль ENGINEER (регрессия)', () => {
        const result = targetRoleSchema.safeParse('ENGINEER');
        expect(result.success).toBe(true);
    });
});

describe('salaryRuleRequestSchema — DepartmentPercent (FR2)', () => {
    // FR2: процент от факта выручки/маржи отдела/категории, без коэффициента.
    it('принимает валидное правило DepartmentPercent с category = null (весь склад/направление)', () => {
        const result = salaryRuleRequestSchema.safeParse({
            type: 'DepartmentPercent',
            name: 'Процент от выручки направления',
            targetRole: 'DEPARTMENT_HEAD',
            config: {
                salaryBasis: 'REVENUE',
                category: null,
                percent: 3.5,
            },
        });
        expect(result.success).toBe(true);
    });

    // FR2: category — явный scope-параметр, как у ProductSold/OrderPayed.
    it('принимает валидное правило DepartmentPercent с конкретной category', () => {
        const result = salaryRuleRequestSchema.safeParse({
            type: 'DepartmentPercent',
            name: 'Процент от маржи категории',
            targetRole: 'DEPARTMENT_HEAD',
            config: {
                salaryBasis: 'MARGIN',
                category: 'iphones',
                percent: 2,
            },
        });
        expect(result.success).toBe(true);
    });

    // FR2: без percent (обязательное поле формулы) правило невалидно.
    it('отклоняет DepartmentPercent без обязательного percent', () => {
        const result = salaryRuleRequestSchema.safeParse({
            type: 'DepartmentPercent',
            name: 'Без процента',
            targetRole: 'DEPARTMENT_HEAD',
            config: {
                salaryBasis: 'REVENUE',
                category: null,
            },
        });
        expect(result.success).toBe(false);
    });
});

describe('salaryRuleRequestSchema — DepartmentPlanBonus (FR3)', () => {
    // FR3: фикс-сумма × плавающий коэффициент выполнения плана выручки/маржи, переиспользует
    // percentBorders/FloatPercentSchedule как есть.
    it('принимает валидное правило DepartmentPlanBonus с percentBorders', () => {
        const result = salaryRuleRequestSchema.safeParse({
            type: 'DepartmentPlanBonus',
            name: 'Бонус за план продаж направления',
            targetRole: 'DEPARTMENT_HEAD',
            config: {
                salaryBasis: 'REVENUE',
                category: null,
                fixedAmount: 20000,
                percentBorders,
            },
        });
        expect(result.success).toBe(true);
    });

    // FR3: percentBorders — фиксированная тройка порогов (см. percentBordersSchema), меньшее
    // число элементов невалидно.
    it('отклоняет DepartmentPlanBonus с percentBorders короче трёх элементов', () => {
        const result = salaryRuleRequestSchema.safeParse({
            type: 'DepartmentPlanBonus',
            name: 'Некорректные пороги',
            targetRole: 'DEPARTMENT_HEAD',
            config: {
                salaryBasis: 'REVENUE',
                category: null,
                fixedAmount: 20000,
                percentBorders: percentBorders.slice(0, 2),
            },
        });
        expect(result.success).toBe(false);
    });
});

describe('salaryRuleRequestSchema — DepartmentTurnoverBonus (FR4)', () => {
    // FR4: фикс-сумма × плавающий коэффициент выполнения плана оборачиваемости, привязан к
    // обязательному складу; planTurnoverRatio хранится прямо в конфиге правила (design.md, Decision 2).
    it('принимает валидное правило DepartmentTurnoverBonus с обязательным warehouseId и category = null', () => {
        const result = salaryRuleRequestSchema.safeParse({
            type: 'DepartmentTurnoverBonus',
            name: 'Бонус за оборачиваемость склада',
            targetRole: 'DEPARTMENT_HEAD',
            config: {
                warehouseId: 42,
                category: null,
                fixedAmount: 15000,
                planTurnoverRatio: 1.0,
                percentBorders,
            },
        });
        expect(result.success).toBe(true);
    });

    // FR4: warehouseId — обязательное поле конфигурации (design.md: "обязательное поле
    // конфигурации — оборачиваемость скоуплена по категории × складу").
    it('отклоняет DepartmentTurnoverBonus без обязательного warehouseId', () => {
        const result = salaryRuleRequestSchema.safeParse({
            type: 'DepartmentTurnoverBonus',
            name: 'Без склада',
            targetRole: 'DEPARTMENT_HEAD',
            config: {
                category: null,
                fixedAmount: 15000,
                planTurnoverRatio: 1.0,
                percentBorders,
            },
        });
        expect(result.success).toBe(false);
    });

    // FR4: warehouseId направления service — число (RoApp/RemOnline warehouse id), как в
    // goodsTurnoverReportLineSchema.warehouseId — строковый id (MoySklad) невалиден для service.
    it('отклоняет DepartmentTurnoverBonus со строковым warehouseId', () => {
        const result = salaryRuleRequestSchema.safeParse({
            type: 'DepartmentTurnoverBonus',
            name: 'Строковый склад',
            targetRole: 'DEPARTMENT_HEAD',
            config: {
                warehouseId: 'wh-1',
                category: null,
                fixedAmount: 15000,
                planTurnoverRatio: 1.0,
                percentBorders,
            },
        });
        expect(result.success).toBe(false);
    });
});

describe('salaryRuleRequestSchema — регрессия существующих 4 видов правил', () => {
    // FR2–FR4: добавление 3 новых членов discriminated union не должно ломать существующие виды.
    it('по-прежнему принимает существующее правило PayPerHour', () => {
        const result = salaryRuleRequestSchema.safeParse({
            type: 'PayPerHour',
            name: 'Почасовая ставка',
            targetRole: 'ENGINEER',
            config: { price: 300 },
        });
        expect(result.success).toBe(true);
    });

    it('по-прежнему принимает существующее правило OrderPayed', () => {
        const result = salaryRuleRequestSchema.safeParse({
            type: 'OrderPayed',
            name: 'За оплаченный заказ',
            targetRole: 'ORDER_MANAGER',
            config: {
                award: { type: 'Fixed', price: 500 },
            },
        });
        expect(result.success).toBe(true);
    });
});
