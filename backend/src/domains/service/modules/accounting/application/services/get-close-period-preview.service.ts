import { Inject, Injectable } from '@nestjs/common';
import type { ClosePeriodPreviewResponse } from 'ireports-contracts';
import { Period } from '@/shared/domain/period.value-object';
import type { AccountingDirection } from '@/shared/domain/calculation-context';
import { SALES_PLAN_REPOSITORY } from '@/domains/service/modules/sales/application/ports/sales-plan.port';
import type { SalesPlanRepositoryPort } from '@/domains/service/modules/sales/application/ports/sales-plan.port';
import { SNAPSHOT_ROWS_CALCULATOR } from '@/domains/service/modules/accounting/application/ports/snapshot-rows-calculator.port';
import type { SnapshotRowsCalculatorPort } from '@/domains/service/modules/accounting/application/ports/snapshot-rows-calculator.port';
import { EMPLOYEE_DISMISSAL } from '@/domains/service/modules/accounting/application/ports/employee-dismissal.port';
import type { EmployeeDismissalPort } from '@/domains/service/modules/accounting/application/ports/employee-dismissal.port';
import { EMPLOYEE_HOURS_ENTRY_REPOSITORY } from '@/domains/service/modules/accounting/application/ports/employee-hours-entry.port';
import type { EmployeeHoursEntryRepositoryPort } from '@/domains/service/modules/accounting/application/ports/employee-hours-entry.port';
import type { AccountingPeriodSnapshotRow } from '@/domains/service/modules/accounting/application/ports/accounting-period-snapshot.port';

const PAY_PER_HOUR_RULE_TYPE = 'PayPerHour';

// Сводка окна подтверждения закрытия (PRD 1 docs/payroll-closing-and-accrual,
// Фаза 2) — generic по direction, как GetAccountingPeriodService: строки
// считает тот же SNAPSHOT_ROWS_CALCULATOR, что и закрытие, поэтому при
// неизменных данных числа совпадают с результатом реального закрытия.
// Ничего не пишет: ни синка ERP (это шаг самого закрытия), ни сброса кэша.
@Injectable()
export class GetClosePeriodPreviewService {
    constructor(
        @Inject(SALES_PLAN_REPOSITORY)
        private readonly salesPlanRepo: SalesPlanRepositoryPort,
        @Inject(SNAPSHOT_ROWS_CALCULATOR)
        private readonly rowsCalculator: SnapshotRowsCalculatorPort,
        @Inject(EMPLOYEE_DISMISSAL)
        private readonly employeeDismissal: EmployeeDismissalPort,
        @Inject(EMPLOYEE_HOURS_ENTRY_REPOSITORY)
        private readonly hoursRepo: EmployeeHoursEntryRepositoryPort,
    ) {}

    async execute(
        direction: AccountingDirection,
        periodValue: string,
    ): Promise<ClosePeriodPreviewResponse> {
        const period = Period.create(periodValue);

        const plans = await this.salesPlanRepo.findByDirectionAndPeriod(
            direction,
            period.getValue(),
        );
        const unapprovedPlanRows = plans
            .filter((plan) => plan.status !== 'APPROVED')
            .map((plan) => ({
                id: plan.id,
                department: plan.department,
                category: plan.category,
            }));

        const rows = await this.rowsCalculator.calculate(period);
        const employeeIds = rows.map((row) => row.employeeId);
        const dismissed =
            await this.employeeDismissal.findDismissedEmployeeIds(employeeIds);
        const employeesWithoutHours = await this.countEmployeesWithoutHours(
            period,
            rows,
        );

        return {
            direction,
            period: period.getValue(),
            employeesCount: rows.length,
            dismissedEmployeesCount: employeeIds.filter((id) =>
                dismissed.has(id),
            ).length,
            totalAmount: rows.reduce((sum, row) => sum + row.total, 0),
            unapprovedPlanRows,
            employeesWithoutHours,
        };
    }

    // Сотрудники с правилом PayPerHour, у которых за месяц нет записи часов
    // — руководитель может отменить закрытие и дозаполнить (PRD 1).
    private async countEmployeesWithoutHours(
        period: Period,
        rows: AccountingPeriodSnapshotRow[],
    ): Promise<number> {
        const hourly = rows.filter((row) =>
            row.lines.some((line) => line.type === PAY_PER_HOUR_RULE_TYPE),
        );
        if (hourly.length === 0) {
            return 0;
        }
        const entries = await this.hoursRepo.findByPeriod(period.getValue());
        const withHours = new Set(entries.map((entry) => entry.employeeId));
        return hourly.filter((row) => !withHours.has(row.employeeId)).length;
    }
}
