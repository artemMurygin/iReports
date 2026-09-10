import { DepartmentPercentEntity } from './department-percent.entity';
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

describe('DepartmentPercentEntity (shop)', () => {
    describe('create', () => {
        // FR1: назначается роль «руководитель направления».
        it('создаёт правило с генерируемым id, типом DepartmentPercent и ролью DEPARTMENT_HEAD', () => {
            const rule = DepartmentPercentEntity.create({
                type: 'DepartmentPercent',
                name: 'Процент от выручки магазина',
                targetRole: 'DEPARTMENT_HEAD',
                config: {
                    salaryBasis: 'REVENUE',
                    category: null,
                    percent: 5,
                },
            });

            expect(rule.id).toEqual(expect.any(String));
            expect(rule.type).toBe('DepartmentPercent');
            expect(rule.targetRole).toBe('DEPARTMENT_HEAD');
        });
    });

    describe('calculate — FR2: amount = round(fact.(turnover|margin) * percent / 100)', () => {
        it('REVENUE — процент от фактической выручки категории', () => {
            const rule = DepartmentPercentEntity.create({
                type: 'DepartmentPercent',
                name: 'Правило',
                targetRole: 'DEPARTMENT_HEAD',
                config: { salaryBasis: 'REVENUE', category: null, percent: 5 },
            });
            const performance: DepartmentSalesPerformanceByCategory = new Map([
                [
                    null,
                    {
                        fact: { turnover: 1_000_000, margin: 400_000 },
                        percentCompletion: 80,
                    },
                ],
            ]);

            const line = rule.calculate(buildContext(performance));

            expect(line).toEqual({
                ruleId: rule.id,
                salaryBasis: 'REVENUE',
                rate: 5,
                amount: 50_000,
                sources: [],
            });
        });

        it('MARGIN — процент от фактической маржи категории', () => {
            const rule = DepartmentPercentEntity.create({
                type: 'DepartmentPercent',
                name: 'Правило',
                targetRole: 'DEPARTMENT_HEAD',
                config: {
                    salaryBasis: 'MARGIN',
                    category: 'cat-1',
                    percent: 10,
                },
            });
            const performance: DepartmentSalesPerformanceByCategory = new Map([
                [
                    'cat-1',
                    {
                        fact: { turnover: 500_000, margin: 200_000 },
                        percentCompletion: 60,
                    },
                ],
            ]);

            const line = rule.calculate(buildContext(performance));

            expect(line.amount).toBe(20_000);
        });

        it('резолвит SalesPerformance по СВОЕЙ category правила, а не по магазину целиком', () => {
            const rule = DepartmentPercentEntity.create({
                type: 'DepartmentPercent',
                name: 'Правило',
                targetRole: 'DEPARTMENT_HEAD',
                config: {
                    salaryBasis: 'REVENUE',
                    category: 'cat-A',
                    percent: 10,
                },
            });
            const performance: DepartmentSalesPerformanceByCategory = new Map([
                [
                    null,
                    {
                        fact: { turnover: 1_000_000, margin: 0 },
                        percentCompletion: 0,
                    },
                ],
                [
                    'cat-A',
                    {
                        fact: { turnover: 10_000, margin: 0 },
                        percentCompletion: 0,
                    },
                ],
            ]);

            const line = rule.calculate(buildContext(performance));

            expect(line.amount).toBe(1_000);
        });
    });

    describe('calculate — данные для scope не найдены (design.md Q2 — начисляет 0, без ошибки)', () => {
        it('карта равна null', () => {
            const rule = DepartmentPercentEntity.create({
                type: 'DepartmentPercent',
                name: 'Правило',
                targetRole: 'DEPARTMENT_HEAD',
                config: { salaryBasis: 'REVENUE', category: null, percent: 5 },
            });

            const line = rule.calculate(buildContext(null));

            expect(line.amount).toBe(0);
            expect(line.sources).toEqual([]);
        });

        it('category правила отсутствует в карте', () => {
            const rule = DepartmentPercentEntity.create({
                type: 'DepartmentPercent',
                name: 'Правило',
                targetRole: 'DEPARTMENT_HEAD',
                config: {
                    salaryBasis: 'REVENUE',
                    category: 'cat-missing',
                    percent: 5,
                },
            });
            const performance: DepartmentSalesPerformanceByCategory = new Map([
                [
                    null,
                    {
                        fact: { turnover: 1_000, margin: 0 },
                        percentCompletion: 0,
                    },
                ],
            ]);

            const line = rule.calculate(buildContext(performance));

            expect(line.amount).toBe(0);
        });
    });
});
