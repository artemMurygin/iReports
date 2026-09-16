import { DepartmentPercentEntity } from './department-percent.entity';
import type {
    DepartmentPerformanceOverrideByScope,
    DepartmentSalesPerformanceByCategory,
    ServiceCalculationContext,
} from '@/domains/service/modules/accounting/domain/types/calculation-context.types';
import { ArgumentInvalidException } from '@/shared/exceptions';
import { withRequestContext } from '@/shared/testing/with-request-context';

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

describe('DepartmentPercentEntity', () => {
    describe('create', () => {
        // FR1: назначается роль «руководитель направления».
        it('создаёт правило с генерируемым id, типом DepartmentPercent и ролью DEPARTMENT_HEAD', () => {
            const rule = DepartmentPercentEntity.create({
                type: 'DepartmentPercent',
                name: 'Процент от выручки отдела',
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
                amount: 50_000, // 1_000_000 * 5%
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

            expect(line.amount).toBe(20_000); // 200_000 * 10%
        });

        it('округляет сумму до целого рубля', () => {
            const rule = DepartmentPercentEntity.create({
                type: 'DepartmentPercent',
                name: 'Правило',
                targetRole: 'DEPARTMENT_HEAD',
                config: { salaryBasis: 'REVENUE', category: null, percent: 3 },
            });
            const performance: DepartmentSalesPerformanceByCategory = new Map([
                [
                    null,
                    {
                        fact: { turnover: 1001, margin: 0 },
                        percentCompletion: 0,
                    },
                ],
            ]);

            const line = rule.calculate(buildContext(performance));

            expect(line.amount).toBe(30); // round(1001 * 3 / 100) = round(30.03) = 30
        });

        it('резолвит SalesPerformance по СВОЕЙ category правила, а не по отделу целиком', () => {
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

            expect(line.amount).toBe(1_000); // 10_000 * 10%, НЕ 1_000_000 * 10%
        });
    });

    describe('calculate — данные для scope не найдены (design.md Q2 — начисляет 0, без ошибки)', () => {
        it('карта равна null (у сотрудника нет отдела)', () => {
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

        it('category правила отсутствует в карте (нет плана/факта по этой категории)', () => {
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

    describe('calculate — departmentId (временный костыль): явное переопределение отдела вместо собственного отдела сотрудника', () => {
        it('читает факт из departmentPerformanceOverrides по (departmentId, category), игнорируя departmentSalesPerformance', () => {
            const rule = DepartmentPercentEntity.create({
                type: 'DepartmentPercent',
                name: 'Правило',
                targetRole: 'DEPARTMENT_HEAD',
                config: {
                    salaryBasis: 'REVENUE',
                    category: null,
                    percent: 10,
                    departmentId: 158,
                },
            });
            // departmentSalesPerformance (собственный отдел) намеренно несёт другое значение —
            // правило с departmentId не должно его использовать.
            const ownDepartmentPerformance: DepartmentSalesPerformanceByCategory =
                new Map([
                    [
                        null,
                        {
                            fact: { turnover: 1_000_000, margin: 0 },
                            percentCompletion: 0,
                        },
                    ],
                ]);
            const overrides: DepartmentPerformanceOverrideByScope = new Map([
                [
                    '158:',
                    { fact: { turnover: 50_000, margin: 0 }, percentCompletion: 0 },
                ],
            ]);

            const line = rule.calculate(
                buildContext(ownDepartmentPerformance, overrides),
            );

            expect(line.amount).toBe(5_000); // 50_000 * 10%, не 1_000_000 * 10%
        });

        it('scope отсутствует в overrides — начисляет 0', () => {
            const rule = DepartmentPercentEntity.create({
                type: 'DepartmentPercent',
                name: 'Правило',
                targetRole: 'DEPARTMENT_HEAD',
                config: {
                    salaryBasis: 'REVENUE',
                    category: null,
                    percent: 10,
                    departmentId: 158,
                },
            });

            const line = rule.calculate(buildContext(null, new Map()));

            expect(line.amount).toBe(0);
        });
    });

    describe('calculate — salaryBasis = SALARY_MINUS_ENGINEER_SALARY не поддерживается для правила уровня отдела', () => {
        it('бросает доменную ошибку', () => {
            const rule = DepartmentPercentEntity.create({
                type: 'DepartmentPercent',
                name: 'Правило',
                targetRole: 'DEPARTMENT_HEAD',
                config: {
                    salaryBasis: 'SALARY_MINUS_ENGINEER_SALARY',
                    category: null,
                    percent: 5,
                },
            });
            const performance: DepartmentSalesPerformanceByCategory = new Map([
                [
                    null,
                    {
                        fact: { turnover: 1_000, margin: 500 },
                        percentCompletion: 0,
                    },
                ],
            ]);

            withRequestContext(() => {
                expect(() => rule.calculate(buildContext(performance))).toThrow(
                    ArgumentInvalidException,
                );
            });
        });
    });
});
