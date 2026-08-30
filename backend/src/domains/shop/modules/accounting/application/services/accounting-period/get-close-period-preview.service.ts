import { Inject, Injectable } from '@nestjs/common';
import type { ClosePeriodPreviewResponse } from 'ireports-contracts';
import { Period } from '@/shared/domain/period.value-object';
import { SHOP_SALES_PLAN_REPOSITORY } from '@/domains/shop/modules/sales/application/ports/sales-plan.port';
import type { ShopSalesPlanRepositoryPort } from '@/domains/shop/modules/sales/application/ports/sales-plan.port';
import { SHOP_SNAPSHOT_ROWS_CALCULATOR } from '@/domains/shop/modules/accounting/application/ports/calculation/snapshot-rows-calculator.port';
import type { ShopSnapshotRowsCalculatorPort } from '@/domains/shop/modules/accounting/application/ports/calculation/snapshot-rows-calculator.port';
import { EMPLOYEE_DISMISSAL } from '@/modules/employee-dismissal/application/ports/employee-dismissal.port';
import type { EmployeeDismissalPort } from '@/modules/employee-dismissal/application/ports/employee-dismissal.port';
import { WORK_SCHEDULE_ENTRY_REPOSITORY } from '@/modules/work-schedule/application/ports/work-schedule-entry.port';
import type { WorkScheduleEntryRepositoryPort } from '@/modules/work-schedule/application/ports/work-schedule-entry.port';
import type { ShopAccountingPeriodSnapshotRow } from '@/domains/shop/modules/accounting/application/ports/accounting-period/accounting-period-snapshot.port';

const PAY_PER_HOUR_RULE_TYPE = 'PayPerHour';

// Зеркало domains/service/modules/accounting/application/services/
// get-close-period-preview.service.ts (Фаза 5
// docs/service-shop-boundary-violations-fix) — независимая копия для
// направления shop: строки считает тот же SHOP_SNAPSHOT_ROWS_CALCULATOR,
// что и закрытие (CloseShopAccountingPeriodHandler), поэтому при неизменных
// данных числа совпадают с результатом реального закрытия. Ничего не
// пишет: ни синка ERP (это шаг самого закрытия), ни сброса кэша.
// SHOP_SALES_PLAN_REPOSITORY — с Фазы 7 (docs/service-shop-boundary-violations-fix)
// собственный, независимый от domains/service/modules/sales порт/репозиторий
// направления shop (см. WHY в accounting.module.ts).
@Injectable()
export class GetShopClosePeriodPreviewService {
    constructor(
        @Inject(SHOP_SALES_PLAN_REPOSITORY)
        private readonly salesPlanRepo: ShopSalesPlanRepositoryPort,
        @Inject(SHOP_SNAPSHOT_ROWS_CALCULATOR)
        private readonly rowsCalculator: ShopSnapshotRowsCalculatorPort,
        @Inject(EMPLOYEE_DISMISSAL)
        private readonly employeeDismissal: EmployeeDismissalPort,
        @Inject(WORK_SCHEDULE_ENTRY_REPOSITORY)
        private readonly workScheduleRepo: WorkScheduleEntryRepositoryPort,
    ) {}

    async execute(periodValue: string): Promise<ClosePeriodPreviewResponse> {
        const direction = 'shop' as const;
        const period = Period.create(periodValue);

        const plans = await this.salesPlanRepo.findByPeriod(period.getValue());
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

    // Сотрудники с правилом PayPerHour, у которых за месяц нет отработанных
    // часов графика — руководитель может отменить закрытие и дозаполнить.
    // Источник — WorkScheduleEntry (общий для направлений).
    private async countEmployeesWithoutHours(
        period: Period,
        rows: ShopAccountingPeriodSnapshotRow[],
    ): Promise<number> {
        const hourly = rows.filter((row) =>
            row.lines.some((line) => line.type === PAY_PER_HOUR_RULE_TYPE),
        );
        if (hourly.length === 0) {
            return 0;
        }
        const { from, to } = period.getBounds();
        const entries =
            await this.workScheduleRepo.findByEmployeeIdsAndDateRange(
                hourly.map((row) => row.employeeId),
                from,
                to,
            );
        const withHours = new Set(
            entries
                .filter((entry) => entry.day.hours !== null)
                .map((entry) => entry.employeeId),
        );
        return hourly.filter((row) => !withHours.has(row.employeeId)).length;
    }
}
