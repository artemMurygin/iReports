import { Inject, Injectable } from '@nestjs/common';
import type {
    PayoutEmployeeRow,
    PayoutPageResponse,
    PayoutStatus,
} from 'ireports-contracts';
import { Period } from '@/shared/domain/period.value-object';
import { BALANCE_TRANSACTION_REPOSITORY } from '@/domains/service/modules/accounting/application/ports/balance-transaction.port';
import type { BalanceTransactionRepositoryPort } from '@/domains/service/modules/accounting/application/ports/balance-transaction.port';
import { SALARY_ACCRUAL_REPOSITORY } from '@/domains/service/modules/accounting/application/ports/salary-accrual.port';
import type { SalaryAccrualRepositoryPort } from '@/domains/service/modules/accounting/application/ports/salary-accrual.port';
import { DIRECTORY_REPOSITORY } from '@/modules/directory/application/ports/directory.port';
import type { DirectoryRepositoryPort } from '@/modules/directory/application/ports/directory.port';
import { BalanceTransaction } from '@/domains/service/modules/accounting/domain/entities/balance-transaction.entity';
import { resolveEmployees } from './list-salary-accruals.service';
import { unknownEmployeeInfo } from '../mappers/to-salary-accrual-response';

// Страница выплаты направления service (PRD 3
// docs/payroll-closing-and-accrual/prd-salary-payout-and-erp-cash-documents.md,
// «Контракты»: GET /v1/{direction}/accounting/payout/:period) — по образцу
// GetDepartmentBalancesService (Фаза 7), но per-direction (страница выплаты
// одного направления, а не сводка по отделу на оба). Строка — сотрудник,
// у которого есть документ начисления (SalaryAccrual) этого периода и
// направления: тот же приём отбора, что ListSalaryAccrualsService — открытый
// период (документов ещё нет) даёт пустую страницу, не ошибку.
//
// accrued/advances/manual — те же срезы, что и у сводки по отделу, но
// отфильтрованы ТОЛЬКО по направлению страницы (см. WHY в
// payoutEmployeeRowSchema, contracts/commands/salary-payout.ts): сводка по
// отделу объединяет оба направления, эта страница — нет. balance — SUM всей
// ленты сотрудника независимо от направления (общий остаток, PRD 2). paid —
// движения PAYOUT этого направления с датой внутри месяца (PAYOUT не несёт
// поле period — см. BalanceTransaction.forPayout).
@Injectable()
export class GetPayoutPageService {
    constructor(
        @Inject(BALANCE_TRANSACTION_REPOSITORY)
        private readonly transactionRepo: BalanceTransactionRepositoryPort,
        @Inject(SALARY_ACCRUAL_REPOSITORY)
        private readonly accrualRepo: SalaryAccrualRepositoryPort,
        @Inject(DIRECTORY_REPOSITORY)
        private readonly directoryRepo: DirectoryRepositoryPort,
    ) {}

    async execute(periodValue: string): Promise<PayoutPageResponse> {
        const period = Period.create(periodValue);
        const bounds = period.getBounds();

        const accruals = await this.accrualRepo.findByDirectionAndPeriod(
            'service',
            period.getValue(),
        );
        const employeeIds = [...new Set(accruals.map((a) => a.employeeId))];
        const employees = await resolveEmployees(this.directoryRepo);

        const [balances, transactions] = await Promise.all([
            this.transactionRepo.sumByEmployees(employeeIds),
            this.transactionRepo.findForDepartmentSummary(
                employeeIds,
                period.getValue(),
                bounds.from,
                bounds.to,
            ),
        ]);

        const byEmployee = new Map<number, BalanceTransaction[]>();
        for (const transaction of transactions) {
            // Страница одного направления (см. WHY выше) — движения ДРУГОГО
            // направления в срезы не входят, хотя и участвуют в общем
            // balance (SUM всей ленты, читается отдельно через sumByEmployees).
            if (transaction.direction !== 'service') {
                continue;
            }
            const list = byEmployee.get(transaction.employeeId) ?? [];
            list.push(transaction);
            byEmployee.set(transaction.employeeId, list);
        }

        const rows: PayoutEmployeeRow[] = employeeIds.map((employeeId) => {
            const own = byEmployee.get(employeeId) ?? [];
            const balance = balances.get(employeeId) ?? 0;
            const paid = sumBy(
                own,
                (transaction) =>
                    transaction.type === 'PAYOUT' &&
                    isWithin(transaction, bounds.from, bounds.to),
            );
            const employeeName = (
                employees.get(employeeId) ?? unknownEmployeeInfo(employeeId)
            ).name;
            return {
                employeeId,
                name: employeeName,
                accrued: sumBy(
                    own,
                    (transaction) =>
                        (transaction.type === 'SALARY_ACCRUAL' ||
                            transaction.type === 'ACCRUAL_ADJUSTMENT') &&
                        transaction.period === period.getValue(),
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
                balance,
                paid,
                payoutStatus: resolvePayoutStatus(balance, paid),
            };
        });

        return {
            period: period.getValue(),
            direction: 'service',
            totals: {
                accrued: rows.reduce((sum, row) => sum + row.accrued, 0),
                advances: rows.reduce((sum, row) => sum + row.advances, 0),
                manual: rows.reduce((sum, row) => sum + row.manual, 0),
                balance: rows.reduce((sum, row) => sum + row.balance, 0),
                paid: rows.reduce((sum, row) => sum + row.paid, 0),
            },
            employees: rows,
        };
    }
}

// «Не выплачено» — ещё ни одной выплаты в периоде; «Выплачено частично» —
// была хотя бы одна, но общий остаток ещё положительный; «Выплачено» —
// остаток ≤ 0 (тот же критерий, что переводит документы начисления в PAID,
// см. SalaryAccrual.markPaid) — см. WHY в payoutStatusSchema, contracts.
function resolvePayoutStatus(balance: number, paid: number): PayoutStatus {
    if (balance <= 0) {
        return 'PAID';
    }
    return paid === 0 ? 'NOT_PAID' : 'PARTIALLY_PAID';
}

const MANUAL_SUMMARY_TYPES = new Set([
    'BONUS',
    'SICK_LEAVE',
    'VACATION_PAY',
    'PENALTY',
    'ADJUSTMENT',
]);

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
