import { CalculateServiceSnapshotRowsService } from './calculate-service-snapshot-rows.service';
import type { BuildServiceCalculationContextService } from './build-service-calculation-context.service';
import type { ResolveEmployeeSalaryRulesService } from './resolve-employee-salary-rules.service';
import { DepartmentPercentEntity } from '@/domains/service/modules/accounting/domain/entities/salary-rules/department-percent.entity';
import { Period } from '@/shared/domain/period.value-object';

// Implements FR2-FR4 of add-department-head-salary-rules.
//
// CalculateServiceSnapshotRowsService строит CalculationContext, передаваемый в rule.calculate(),
// перечисляя поля явно (employee/period/erpData/mode/salesPerformance), а не спредом полного
// ServiceCalculationBaseContext — из-за этого departmentSalesPerformance/turnoverPerformance,
// которые BuildServiceCalculationContextService уже резолвит, не доходили до
// DepartmentPercent/DepartmentPlanBonus/DepartmentTurnoverBonus правил, и те молча считали 0 (см.
// design.md Q2 "no data for scope → 0, no throw" fallback этих правил).
describe('CalculateServiceSnapshotRowsService — departmentSalesPerformance доходит до rule.calculate()', () => {
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
        } as unknown as ResolveEmployeeSalaryRulesService;

        const contextBuilder = {
            build: jest.fn().mockResolvedValue({
                employee: { id: 42, identities: [] },
                period: {
                    direction: 'service' as const,
                    period: '2026-08',
                    ...Period.create('2026-08').getBounds(),
                    status: 'OPEN' as const,
                },
                erpData: {
                    serviceCompletedItems: [],
                    hoursWorked: { fact: 0, prognose: 0 },
                },
                salesPerformanceDetail: null,
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
        } as unknown as BuildServiceCalculationContextService;

        const service = new CalculateServiceSnapshotRowsService(
            contextBuilder,
            salaryRulesResolver,
        );

        const rows = await service.calculate(Period.create('2026-08'));

        expect(rows).toHaveLength(1);
        expect(rows[0].total).toBe(10000);
    });
});
