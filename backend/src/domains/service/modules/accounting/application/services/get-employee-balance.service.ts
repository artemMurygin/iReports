import { Inject, Injectable } from '@nestjs/common';
import type { EmployeeBalanceResponse } from 'ireports-contracts';
import { BALANCE_TRANSACTION_REPOSITORY } from '@/domains/service/modules/accounting/application/ports/balance-transaction.port';
import type {
    BalanceTransactionFilter,
    BalanceTransactionRepositoryPort,
} from '@/domains/service/modules/accounting/application/ports/balance-transaction.port';
import { toBalanceTransactionResponse } from '../mappers/to-balance-transaction-response';

// Общий баланс сотрудника (PRD 2 docs/payroll-closing-and-accrual, Фаза 8b,
// GET /v1/accounting/balance/employee/:id?from&to&types): один остаток и
// одна лента на employeeId — движения документов обоих направлений и
// ручные движения лежат в ней вперемешку, direction движения — лишь
// атрибут происхождения.
//
// balance — SUM всей ленты сотрудника, не зависящая от фильтров: хранимого
// поля «остаток» нет (PRD 2). transactions — движения по фильтрам,
// selectionTotal — их сумма. Строка ленты не раскрывается: детализация
// начисления живёт в документе, движение несёт ссылку accrualId.
// Сотрудник без движений — это остаток 0 и пустая лента, не ошибка.
@Injectable()
export class GetEmployeeBalanceService {
    constructor(
        @Inject(BALANCE_TRANSACTION_REPOSITORY)
        private readonly transactionRepo: BalanceTransactionRepositoryPort,
    ) {}

    async execute(
        employeeId: number,
        filter: BalanceTransactionFilter,
    ): Promise<EmployeeBalanceResponse> {
        const [balance, transactions] = await Promise.all([
            this.transactionRepo.sumByEmployee(employeeId),
            this.transactionRepo.findByEmployee(employeeId, filter),
        ]);

        return {
            employeeId,
            balance,
            selectionTotal: transactions.reduce(
                (sum, transaction) => sum + transaction.amount,
                0,
            ),
            transactions: transactions.map((transaction) =>
                toBalanceTransactionResponse(transaction),
            ),
        };
    }
}
