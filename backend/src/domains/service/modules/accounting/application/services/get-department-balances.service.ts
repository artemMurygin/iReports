import { Inject, Injectable } from '@nestjs/common';
import type {
    DepartmentBalancesResponse,
    DepartmentEmployeeBalance,
    SalaryAccrualStatus,
} from 'ireports-contracts';
import { Period } from '@/shared/domain/period.value-object';
import { BALANCE_TRANSACTION_REPOSITORY } from '@/domains/service/modules/accounting/application/ports/balance-transaction.port';
import type { BalanceTransactionRepositoryPort } from '@/domains/service/modules/accounting/application/ports/balance-transaction.port';
import { SALARY_ACCRUAL_REPOSITORY } from '@/domains/service/modules/accounting/application/ports/salary-accrual.port';
import type { SalaryAccrualRepositoryPort } from '@/domains/service/modules/accounting/application/ports/salary-accrual.port';
import { DIRECTORY_REPOSITORY } from '@/modules/directory/application/ports/directory.port';
import type { DirectoryRepositoryPort } from '@/modules/directory/application/ports/directory.port';
import { BalanceTransaction } from '@/domains/service/modules/accounting/domain/entities/balance-transaction.entity';

// Сводка общих балансов по отделу за месяц (PRD 2, Фаза 7; общий баланс —
// Фаза 8b, GET /v1/accounting/balance/department/:id/:period): движения
// обоих направлений и ручные движения — одна лента сотрудника, направление
// в сводке не участвует.
//
// Отдел берётся ТЕКУЩИЙ — состав сотрудников из справочника Bitrix24 на
// момент запроса, в движении отдел не хранится (PRD 2, «Не в скоупе»).
// Сотрудник отдела без движений — строка с нулями, не пропуск.
//
// Колонки (суммы со знаком, как в ленте):
// - balance — SUM всей ленты сотрудника, от периода не зависит;
// - accrued — движения начисления (SALARY_ACCRUAL/ACCRUAL_ADJUSTMENT)
//   запрошенного периода по полю period движения (их occurredAt — момент
//   проведения, который может быть в другом месяце);
// - advances — ADVANCE/EXTRA_ADVANCE с датой движения внутри месяца;
// - manual — остальные ручные типы (BONUS/SICK_LEAVE/VACATION_PAY/
//   PENALTY/ADJUSTMENT) с датой внутри месяца.
// PAYOUT (PRD 3) в колонки не входит — участвует только в balance.
// accrualStatus — сводный статус документов начисления сотрудника за
// период по ОБОИМ направлениям: наименее продвинутый (DRAFT <
// PARTIALLY_ACCRUED < ACCRUED < PAID) — колонка показывает, что по
// сотруднику ещё осталось сделать; null — документов нет.
// Итог по отделу — сумма строк сотрудников (инвариант проверяется тестом).
@Injectable()
export class GetDepartmentBalancesService {
    constructor(
        @Inject(BALANCE_TRANSACTION_REPOSITORY)
        private readonly transactionRepo: BalanceTransactionRepositoryPort,
        @Inject(SALARY_ACCRUAL_REPOSITORY)
        private readonly accrualRepo: SalaryAccrualRepositoryPort,
        @Inject(DIRECTORY_REPOSITORY)
        private readonly directoryRepo: DirectoryRepositoryPort,
    ) {}

    async execute(
        departmentId: number,
        periodValue: string,
    ): Promise<DepartmentBalancesResponse> {
        const period = Period.create(periodValue);
        const bounds = period.getBounds();
        const employees = await this.directoryRepo.findEmployees(departmentId);
        const employeeIds = employees.map((employee) => employee.id);

        // Документы начисления периода — по обоим направлениям: репозиторий
        // документов direction-скоуплен (документы, в отличие от баланса,
        // остаются направленческими), поэтому два запроса и объединение.
        const [balances, transactions, serviceAccruals, shopAccruals] =
            await Promise.all([
                this.transactionRepo.sumByEmployees(employeeIds),
                this.transactionRepo.findForDepartmentSummary(
                    employeeIds,
                    period.getValue(),
                    bounds.from,
                    bounds.to,
                ),
                this.accrualRepo.findByDirectionAndPeriod(
                    'service',
                    period.getValue(),
                ),
                this.accrualRepo.findByDirectionAndPeriod(
                    'shop',
                    period.getValue(),
                ),
            ]);

        const accrualStatusByEmployee = new Map<number, SalaryAccrualStatus>();
        for (const accrual of [...serviceAccruals, ...shopAccruals]) {
            const current = accrualStatusByEmployee.get(accrual.employeeId);
            if (
                !current ||
                STATUS_PROGRESS[accrual.status] < STATUS_PROGRESS[current]
            ) {
                accrualStatusByEmployee.set(accrual.employeeId, accrual.status);
            }
        }
        const byEmployee = new Map<number, BalanceTransaction[]>();
        for (const transaction of transactions) {
            const list = byEmployee.get(transaction.employeeId) ?? [];
            list.push(transaction);
            byEmployee.set(transaction.employeeId, list);
        }

        const rows: DepartmentEmployeeBalance[] = employees.map((employee) => {
            const own = byEmployee.get(employee.id) ?? [];
            return {
                employeeId: employee.id,
                employeeName: `${employee.firstName} ${employee.lastName}`,
                balance: balances.get(employee.id) ?? 0,
                accrued: sumBy(own, (transaction) =>
                    isAccrualOfPeriod(transaction, period.getValue()),
                ),
                advances: sumBy(
                    own,
                    (transaction) =>
                        isWithin(transaction, bounds.from, bounds.to) &&
                        (transaction.type === 'ADVANCE' ||
                            transaction.type === 'EXTRA_ADVANCE'),
                ),
                manual: sumBy(
                    own,
                    (transaction) =>
                        isWithin(transaction, bounds.from, bounds.to) &&
                        MANUAL_SUMMARY_TYPES.has(transaction.type),
                ),
                accrualStatus: accrualStatusByEmployee.get(employee.id) ?? null,
            };
        });

        return {
            departmentId,
            period: period.getValue(),
            employees: rows,
            totals: {
                balance: rows.reduce((sum, row) => sum + row.balance, 0),
                accrued: rows.reduce((sum, row) => sum + row.accrued, 0),
                advances: rows.reduce((sum, row) => sum + row.advances, 0),
                manual: rows.reduce((sum, row) => sum + row.manual, 0),
            },
        };
    }
}

// Порядок продвижения статуса документа: сводный статус сотрудника —
// наименее продвинутый из его документов за период (см. комментарий выше).
const STATUS_PROGRESS: Record<SalaryAccrualStatus, number> = {
    DRAFT: 0,
    PARTIALLY_ACCRUED: 1,
    ACCRUED: 2,
    PAID: 3,
};

const MANUAL_SUMMARY_TYPES = new Set([
    'BONUS',
    'SICK_LEAVE',
    'VACATION_PAY',
    'PENALTY',
    'ADJUSTMENT',
]);

function isAccrualOfPeriod(
    transaction: BalanceTransaction,
    period: string,
): boolean {
    return (
        (transaction.type === 'SALARY_ACCRUAL' ||
            transaction.type === 'ACCRUAL_ADJUSTMENT') &&
        transaction.period === period
    );
}

function isWithin(
    transaction: BalanceTransaction,
    from: Date,
    to: Date,
): boolean {
    return transaction.occurredAt >= from && transaction.occurredAt <= to;
}

function sumBy(
    transactions: BalanceTransaction[],
    predicate: (transaction: BalanceTransaction) => boolean,
): number {
    return transactions
        .filter(predicate)
        .reduce((sum, transaction) => sum + transaction.amount, 0);
}
