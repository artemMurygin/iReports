import { Inject, Injectable } from '@nestjs/common';
import type { EmployeeBalanceResponse } from 'ireports-contracts';
import type { AccountingDirection } from '@/shared/domain/calculation-context';
import { BALANCE_TRANSACTION_REPOSITORY } from '@/domains/service/modules/accounting/application/ports/balance-transaction.port';
import type {
    BalanceTransactionFilter,
    BalanceTransactionRepositoryPort,
} from '@/domains/service/modules/accounting/application/ports/balance-transaction.port';
import { SALARY_ACCRUAL_REPOSITORY } from '@/domains/service/modules/accounting/application/ports/salary-accrual.port';
import type { SalaryAccrualRepositoryPort } from '@/domains/service/modules/accounting/application/ports/salary-accrual.port';
import { SalaryAccrualLine } from '@/domains/service/modules/accounting/domain/entities/salary-accrual-line.entity';
import { toBalanceTransactionResponse } from '../mappers/to-balance-transaction-response';

// Баланс сотрудника по направлению (PRD 2 docs/payroll-closing-and-accrual,
// GET .../balance/employee/:id?from&to&types) — generic по direction, как
// ListSalaryAccrualsService: контроллеры обоих доменов подставляют своё
// направление, ShopAccountingModule заводит собственный экземпляр.
//
// balance — SUM всей ленты пары (employeeId, direction), не зависящая от
// фильтров: хранимого поля «остаток» нет (PRD 2). transactions — движения
// по фильтрам, selectionTotal — их сумма. Движения начисления раскрываются
// до строки документа (accrualLine): один запрос findByIds на все
// документы выборки, идентичность строке гарантирована тем, что храним
// идентификаторы, а не копии. Сотрудник без движений — это остаток 0 и
// пустая лента, не ошибка.
@Injectable()
export class GetEmployeeBalanceService {
    constructor(
        @Inject(BALANCE_TRANSACTION_REPOSITORY)
        private readonly transactionRepo: BalanceTransactionRepositoryPort,
        @Inject(SALARY_ACCRUAL_REPOSITORY)
        private readonly accrualRepo: SalaryAccrualRepositoryPort,
    ) {}

    async execute(
        direction: AccountingDirection,
        employeeId: number,
        filter: BalanceTransactionFilter,
    ): Promise<EmployeeBalanceResponse> {
        const [balance, transactions] = await Promise.all([
            this.transactionRepo.sumByEmployee(direction, employeeId),
            this.transactionRepo.findByEmployee(direction, employeeId, filter),
        ]);

        const [reversedIds, lineById] = await Promise.all([
            this.transactionRepo.findReversedIds(
                transactions.map((transaction) => transaction.id),
            ),
            this.resolveAccrualLines(transactions),
        ]);

        return {
            employeeId,
            direction,
            balance,
            selectionTotal: transactions.reduce(
                (sum, transaction) => sum + transaction.amount,
                0,
            ),
            transactions: transactions.map((transaction) =>
                toBalanceTransactionResponse(
                    transaction,
                    (transaction.lineId
                        ? lineById.get(transaction.lineId)
                        : undefined) ?? null,
                    reversedIds.has(transaction.id),
                ),
            ),
        };
    }

    private async resolveAccrualLines(
        transactions: { accrualId?: string }[],
    ): Promise<Map<string, SalaryAccrualLine>> {
        const accrualIds = [
            ...new Set(
                transactions
                    .map((transaction) => transaction.accrualId)
                    .filter((id): id is string => Boolean(id)),
            ),
        ];
        if (accrualIds.length === 0) {
            return new Map();
        }
        const accruals = await this.accrualRepo.findByIds(accrualIds);
        return new Map(
            accruals.flatMap((accrual) =>
                accrual.lines.map(
                    (line) => [line.id, line] as [string, SalaryAccrualLine],
                ),
            ),
        );
    }
}
