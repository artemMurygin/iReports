import { Inject, Injectable } from '@nestjs/common';
import type {
    DepartmentBalancesResponse,
    DepartmentEmployeeBalance,
} from 'ireports-contracts';
import { Period } from '@/shared/domain/period.value-object';
import type { AccountingDirection } from '@/shared/domain/calculation-context';
import { BALANCE_TRANSACTION_REPOSITORY } from '@/domains/service/modules/accounting/application/ports/balance-transaction.port';
import type { BalanceTransactionRepositoryPort } from '@/domains/service/modules/accounting/application/ports/balance-transaction.port';
import { SALARY_ACCRUAL_REPOSITORY } from '@/domains/service/modules/accounting/application/ports/salary-accrual.port';
import type { SalaryAccrualRepositoryPort } from '@/domains/service/modules/accounting/application/ports/salary-accrual.port';
import { DIRECTORY_REPOSITORY } from '@/modules/directory/application/ports/directory.port';
import type { DirectoryRepositoryPort } from '@/modules/directory/application/ports/directory.port';
import { BalanceTransaction } from '@/domains/service/modules/accounting/domain/entities/balance-transaction.entity';

// Сводка балансов по отделу за месяц (PRD 2, Фаза 7,
// GET .../balance/department/:id/:period) — generic по direction, как
// GetEmployeeBalanceService: контроллеры обоих доменов подставляют своё
// направление, ShopAccountingModule заводит собственный экземпляр.
//
// Отдел берётся ТЕКУЩИЙ — состав сотрудников из справочника Bitrix24 на
// момент запроса, в движении отдел не хранится (PRD 2, «Не в скоупе»).
// Сотрудник отдела без движений — строка с нулями, не пропуск.
//
// Колонки (суммы со знаком, как в ленте):
// - balance — SUM всей ленты пары, от периода не зависит;
// - accrued — движения начисления (SALARY_ACCRUAL/ACCRUAL_ADJUSTMENT)
//   запрошенного периода по полю period движения (их occurredAt — момент
//   проведения, который может быть в другом месяце);
// - advances — ADVANCE/EXTRA_ADVANCE с датой движения внутри месяца;
// - manual — остальные ручные типы и сторно (BONUS/SICK_LEAVE/VACATION_PAY/
//   PENALTY/ADJUSTMENT/MANUAL_REVERSAL) с датой внутри месяца.
// PAYOUT (PRD 3) в колонки не входит — участвует только в balance.
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
        direction: AccountingDirection,
        departmentId: number,
        periodValue: string,
    ): Promise<DepartmentBalancesResponse> {
        const period = Period.create(periodValue);
        const bounds = period.getBounds();
        const employees = await this.directoryRepo.findEmployees(departmentId);
        const employeeIds = employees.map((employee) => employee.id);

        const [balances, transactions, accruals] = await Promise.all([
            this.transactionRepo.sumByEmployees(direction, employeeIds),
            this.transactionRepo.findForDepartmentSummary(
                direction,
                employeeIds,
                period.getValue(),
                bounds.from,
                bounds.to,
            ),
            this.accrualRepo.findByDirectionAndPeriod(
                direction,
                period.getValue(),
            ),
        ]);

        const accrualStatusByEmployee = new Map(
            accruals.map((accrual) => [accrual.employeeId, accrual.status]),
        );
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
            direction,
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

const MANUAL_SUMMARY_TYPES = new Set([
    'BONUS',
    'SICK_LEAVE',
    'VACATION_PAY',
    'PENALTY',
    'ADJUSTMENT',
    'MANUAL_REVERSAL',
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
