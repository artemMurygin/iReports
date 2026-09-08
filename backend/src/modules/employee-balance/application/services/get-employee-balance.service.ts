import { Inject, Injectable } from '@nestjs/common';
import type { EmployeeBalanceResponse } from 'ireports-contracts';
import { BALANCE_TRANSACTION_REPOSITORY } from '@/modules/employee-balance/application/ports/balance-transaction.port';
import type {
    BalanceTransactionFilter,
    BalanceTransactionRepositoryPort,
} from '@/modules/employee-balance/application/ports/balance-transaction.port';
import { PAYOUT_CASHBOX_RECORD_REPOSITORY } from '@/domains/service/modules/accounting/application/ports/erp-cash/payout-cashbox-record-repository.port';
import type { PayoutCashboxRecordRepositoryPort } from '@/domains/service/modules/accounting/application/ports/erp-cash/payout-cashbox-record-repository.port';
import { toBalanceTransactionResponse } from '../mappers/to-balance-transaction-response';

// Общий баланс сотрудника (PRD 2 docs/payroll-closing-and-accrual, Фаза 8b,
// GET /v1/accounting/balance/employee/:id?from&to&types): один остаток и
// одна лента на employeeId — движения документов обоих направлений и
// ручные движения лежат в ней вперемешку, direction движения — лишь
// атрибут происхождения.
//
// balance — SUM всей ленты сотрудника, не зависящая от фильтров: хранимого
// поля «остаток» нет (PRD 2). transactions — движения ТЕКУЩЕЙ СТРАНИЦЫ по
// фильтрам (Фаза 7 docs/employee-settlements-page-redesign — курсорная
// пагинация, «за всё время» без обязательного периода), selectionTotal —
// сумма ВСЕЙ отфильтрованной выборки, не только страницы (см.
// sumFilteredByEmployee — независимый от findByEmployee запрос с тем же
// where, а не reduce() по уже пагинированному массиву, как было до Фазы 7).
// Строка ленты не раскрывается: детализация начисления живёт в документе,
// движение несёт ссылку accrualId. Сотрудник без движений — это остаток 0 и
// пустая лента, не ошибка.
@Injectable()
export class GetEmployeeBalanceService {
    constructor(
        @Inject(BALANCE_TRANSACTION_REPOSITORY)
        private readonly transactionRepo: BalanceTransactionRepositoryPort,
        @Inject(PAYOUT_CASHBOX_RECORD_REPOSITORY)
        private readonly payoutCashboxRecordRepo: PayoutCashboxRecordRepositoryPort,
    ) {}

    async execute(
        employeeId: number,
        filter: BalanceTransactionFilter,
    ): Promise<EmployeeBalanceResponse> {
        const [balance, selectionTotal, page] = await Promise.all([
            this.transactionRepo.sumByEmployee(employeeId),
            this.transactionRepo.sumFilteredByEmployee(employeeId, filter),
            this.transactionRepo.findByEmployee(employeeId, filter),
        ]);
        const transactions = page.items;

        // Внешний ID документа ERP в ленте (PRD 3, «Критерии готовности») —
        // один батч-запрос по всем движениям выборки с erpSyncRequired,
        // а не N+1 по одному на движение (см. WHY на
        // PayoutCashboxRecordRepositoryPort.findByTransactionIds).
        const erpTransactionIds = transactions
            .filter((transaction) => transaction.erpSyncRequired)
            .map((transaction) => transaction.id);
        const erpDocuments =
            await this.payoutCashboxRecordRepo.findByTransactionIds(
                erpTransactionIds,
            );
        const erpByTransactionId = new Map(
            erpDocuments.map((document) => [document.transactionId, document]),
        );

        return {
            employeeId,
            balance,
            selectionTotal,
            transactions: transactions.map((transaction) => {
                const erpDocument = erpByTransactionId.get(transaction.id);
                return toBalanceTransactionResponse(
                    transaction,
                    erpDocument
                        ? {
                              system: erpDocument.system,
                              externalId: erpDocument.externalId,
                          }
                        : null,
                );
            }),
            nextCursor: page.nextCursor,
            hasMore: page.hasMore,
        };
    }
}
