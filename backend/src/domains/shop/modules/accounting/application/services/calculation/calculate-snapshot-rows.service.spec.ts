import { CalculateShopSnapshotRowsService } from './calculate-snapshot-rows.service';
import type { BuildShopCalculationContextService } from './build-calculation-context.service';
import type { ResolveShopEmployeeSalaryRulesService } from './resolve-employee-salary-rules.service';
import { DepartmentPercentEntity } from '@/domains/shop/modules/accounting/domain/entities/salary-rules/department-percent.entity';
import { Period } from '@/shared/domain/period.value-object';

// Implements FR2-FR4 of add-department-head-salary-rules.
//
// CalculateShopSnapshotRowsService (зеркало CalculateServiceSnapshotRowsService) строит
// ShopCalculationContext, передаваемый в rule.calculate(), перечисляя поля явно, а не спредом
// полного ShopCalculationBaseContext — departmentSalesPerformance/turnoverPerformance, которые
// BuildShopCalculationContextService уже резолвит, не доходили до
// DepartmentPercent/DepartmentPlanBonus/DepartmentTurnoverBonus правил, и те молча считали 0.
describe('CalculateShopSnapshotRowsService — departmentSalesPerformance доходит до rule.calculate()', () => {
    const buildRule = (category: string | null) =>
        DepartmentPercentEntity.create({
            type: 'DepartmentPercent',
            name: 'Процент от факта',
            targetRole: 'DEPARTMENT_HEAD',
            config: { salaryBasis: 'REVENUE', category, percent: 10 },
        });

    it('передаёт departmentSalesPerformance из контекста в calculate() DepartmentPercent-правила', async () => {
        const rule = buildRule('cat-1');
        const salaryRulesResolver = {
            forAllTargets: jest
                .fn()
                .mockResolvedValue(
                    new Map([[42, { rules: [rule], schemasVersion: 'v1' }]]),
                ),
        } as unknown as ResolveShopEmployeeSalaryRulesService;

        const shopContextBuilder = {
            build: jest.fn().mockResolvedValue({
                employee: { id: 42, identities: [] },
                period: {
                    direction: 'shop' as const,
                    period: '2026-08',
                    ...Period.create('2026-08').getBounds(),
                    status: 'OPEN' as const,
                },
                erpData: { hoursWorked: { fact: 0, prognose: 0 } },
                salesPerformanceDetail: null,
                salesPerformanceByCategory: new Map(),
                salesPerformanceByDepartment: [],
                // fact.turnover=100000 * percent 10% = 10000 — ненулевой ожидаемый результат,
                // который DepartmentPercentEntity.calculate() выдаёт ТОЛЬКО если
                // context.departmentSalesPerformance реально дошёл до неё.
                departmentSalesPerformance: new Map([
                    [
                        'cat-1',
                        {
                            fact: { turnover: 100000, margin: 0 },
                            percentCompletion: 80,
                        },
                    ],
                ]),
                turnoverPerformance: new Map(),
            }),
        } as unknown as BuildShopCalculationContextService;

        const service = new CalculateShopSnapshotRowsService(
            shopContextBuilder,
            salaryRulesResolver,
        );

        const rows = await service.calculate(Period.create('2026-08'));

        expect(rows).toHaveLength(1);
        expect(rows[0].total).toBe(10000);
    });
});
