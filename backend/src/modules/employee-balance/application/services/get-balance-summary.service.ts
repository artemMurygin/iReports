import { Inject, Injectable } from '@nestjs/common';
import type {
    BalanceSummaryEmployee,
    BalanceSummaryResponse,
} from 'ireports-contracts';
import { Period } from '@/shared/domain/period.value-object';
import { BALANCE_TRANSACTION_REPOSITORY } from '@/modules/employee-balance/application/ports/balance-transaction.port';
import type { BalanceTransactionRepositoryPort } from '@/modules/employee-balance/application/ports/balance-transaction.port';
import { DIRECTORY_REPOSITORY } from '@/modules/directory/application/ports/directory.port';
import type { DirectoryRepositoryPort } from '@/modules/directory/application/ports/directory.port';
import { EMPLOYEE_DISMISSAL } from '@/modules/employee-dismissal/application/ports/employee-dismissal.port';
import type { EmployeeDismissalPort } from '@/modules/employee-dismissal/application/ports/employee-dismissal.port';

// Фильтр сквозного списка взаиморасчётов (docs/employee-settlements-page-redesign,
// Фаза 1): departmentId не передан — сотрудники ВСЕХ отделов; search —
// регистронезависимая подстрока по «Имя Фамилия», в рамках уже
// отфильтрованного (или нет) по отделу состава.
export interface BalanceSummaryFilter {
    departmentId?: number;
    search?: string;
}

// Сквозной (без направления сервис/магазин) список сотрудников с текущим
// общим балансом — GET /v1/accounting/balance/summary/:period
// (docs/employee-settlements-page-redesign, Фаза 1: "Tracer Bullet" —
// основа для всех последующих фаз редизайна страницы «Выплата»).
//
// По образцу GetDepartmentBalancesService (Фаза 7 PRD 2) — тот же приём
// «текущий состав отдела из Bitrix24 + сумма ленты по employeeId», но:
// - departmentId необязателен (DirectoryRepositoryPort.findEmployees(undefined)
//   — сотрудники всех отделов, а не одного);
// - строка не несёт колонки начислено/авансы/ручные ЗА ПЕРИОД — они
//   специфичны сводке ОДНОГО отдела (см. departmentEmployeeBalanceSchema);
//   здесь только текущий сквозной остаток, от периода не зависящий;
//   :period в пути тем не менее обязателен и валидируется тем же Period —
//   единообразие формы маршрута с department/:id/:period и задел на
//   период-зависимые колонки в будущих фазах, без изменения формы пути;
// - добавлены департамент/должность/статус увольнения (карточка
//   сотрудника в списке) и дата последнего движения — max(occurredAt);
// - search сужает состав ДО расчёта остатков/агрегатов (см. execute) —
//   KPI считаются по уже отфильтрованной выборке, как и требует PRD
//   ("Поиск ... в рамках текущего фильтра по отделу").
//
// isDismissed — переиспользует EmployeeDismissalPort (BitrixEmployee.isActive,
// уже читается при закрытии периода, PRD 1 docs/payroll-closing-and-accrual)
// вместо расширения DirectoryRepositoryPort ещё одним полем: порт узкий и
// уже направление-агностичен, ровно то, что нужно здесь. position — новое
// поле EmployeeSummary (BitrixEmployee.position), пока не заполняемое
// синхронизацией (см. TODO у поля в prisma/schema/bitrix.prisma).
@Injectable()
export class GetBalanceSummaryService {
    constructor(
        @Inject(BALANCE_TRANSACTION_REPOSITORY)
        private readonly transactionRepo: BalanceTransactionRepositoryPort,
        @Inject(DIRECTORY_REPOSITORY)
        private readonly directoryRepo: DirectoryRepositoryPort,
        @Inject(EMPLOYEE_DISMISSAL)
        private readonly dismissalRepo: EmployeeDismissalPort,
    ) {}

    async execute(
        periodValue: string,
        filter: BalanceSummaryFilter,
    ): Promise<BalanceSummaryResponse> {
        const period = Period.create(periodValue);

        const [employees, departments] = await Promise.all([
            this.directoryRepo.findEmployees(filter.departmentId),
            this.directoryRepo.findDepartments(),
        ]);
        const departmentNameById = new Map(
            departments.map((department) => [department.id, department.name]),
        );

        const search = filter.search?.trim().toLowerCase();
        const matched = search
            ? employees.filter((employee) =>
                  `${employee.firstName} ${employee.lastName}`
                      .toLowerCase()
                      .includes(search),
              )
            : employees;

        const employeeIds = matched.map((employee) => employee.id);
        const [balances, lastMovementDates, dismissedIds] = await Promise.all([
            this.transactionRepo.sumByEmployees(employeeIds),
            this.transactionRepo.findLastMovementDateByEmployees(employeeIds),
            this.dismissalRepo.findDismissedEmployeeIds(employeeIds),
        ]);

        const rows: BalanceSummaryEmployee[] = matched.map((employee) => ({
            employeeId: employee.id,
            employeeName: `${employee.firstName} ${employee.lastName}`,
            departmentId: employee.departmentId,
            departmentName: departmentNameById.get(employee.departmentId) ?? '',
            position: employee.position ?? null,
            isDismissed: dismissedIds.has(employee.id),
            lastMovementAt: lastMovementDates.get(employee.id) ?? null,
            balance: balances.get(employee.id) ?? 0,
        }));

        // Три KPI (PRD, "В скоупе"): общий остаток — сумма всех строк
        // выборки; «к выплате» — положительные остатки; «долг» —
        // отрицательные (amount со знаком, как в ленте — см. WHY в
        // balanceSummaryTotalsSchema).
        const positive = rows.filter((row) => row.balance > 0);
        const negative = rows.filter((row) => row.balance < 0);

        return {
            period: period.getValue(),
            departmentId: filter.departmentId ?? null,
            employees: rows,
            totals: {
                balance: rows.reduce((sum, row) => sum + row.balance, 0),
                toPay: {
                    amount: positive.reduce((sum, row) => sum + row.balance, 0),
                    count: positive.length,
                },
                debt: {
                    amount: negative.reduce((sum, row) => sum + row.balance, 0),
                    count: negative.length,
                },
            },
        };
    }
}
