import { Inject, Logger } from '@nestjs/common';
import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { UNIT_OF_WORK } from '@/shared/application/ports/unit-of-work.port';
import type { UnitOfWorkPort } from '@/shared/application/ports/unit-of-work.port';
import { EmployeeOperationLock } from '@/shared/infrastructure/sync-lock/employee-operation-lock';
import { BALANCE_TRANSACTION_REPOSITORY } from '@/modules/employee-balance/application/ports/balance-transaction.port';
import type { BalanceTransactionRepositoryPort } from '@/modules/employee-balance/application/ports/balance-transaction.port';
import { SALARY_ACCRUAL_REPOSITORY } from '@/domains/service/modules/accounting/application/ports/salary-accrual.port';
import type { SalaryAccrualRepositoryPort } from '@/domains/service/modules/accounting/application/ports/salary-accrual.port';
import { PAYOUT_CASHBOX_RECORD_REPOSITORY } from '@/domains/service/modules/accounting/application/ports/payout-cashbox-record-repository.port';
import type { PayoutCashboxRecordRepositoryPort } from '@/domains/service/modules/accounting/application/ports/payout-cashbox-record-repository.port';
import { SERVICE_ERP_CASH_DOCUMENT_PORT } from '@/domains/service/modules/accounting/application/ports/erp-cash-document.port';
import type { ErpCashDocumentPort } from '@/domains/service/modules/accounting/application/ports/erp-cash-document.port';
import { BalanceTransactionNotFoundException } from '@/modules/employee-balance/domain/exceptions/balance-transaction.exception';
import { BalanceTransactionNotPayoutException } from '@/modules/employee-balance/domain/exceptions/balance-transaction.exception';
import { PayoutCashboxRecordMissingForTransactionException } from '@/domains/service/modules/accounting/domain/exceptions/erp-cash.exception';
import { DeletePayoutCommand } from './delete-payout.command';

// Удаление выплаты направления service (PRD 3, Фаза 12: «сначала удаляется
// документ в ERP, затем в одной транзакции — движение с баланса и возврат
// документов начисления из PAID в ACCRUED. Если ERP отказала в удалении —
// ничего не меняется... Сторно (PAYOUT_REVERSAL) для выплат не
// используется»). Зеркалит DeleteBalanceTransactionHandler.deleteWithErpSync,
// но НЕ переиспользует его код целиком: этот хендлер дополнительно
// откатывает документы начисления в ACCRUED — операции, которой у общего
// удаления ручных движений нет и быть не должно (движение начисления
// удаляется только действием «Отменить начисление» строки документа).
//
// "Затронутые" PAID-документы при откате — ВСЕ PAID-документы сотрудника
// направления service (см. WHY на SalaryAccrualRepositoryPort.findPaidByEmployee):
// приближение, задокументированная граница, не точный обратный расчёт.
@CommandHandler(DeletePayoutCommand)
export class DeletePayoutHandler implements ICommandHandler<
    DeletePayoutCommand,
    void
> {
    private readonly logger = new Logger(DeletePayoutHandler.name);

    constructor(
        @Inject(BALANCE_TRANSACTION_REPOSITORY)
        private readonly transactionRepo: BalanceTransactionRepositoryPort,
        @Inject(SALARY_ACCRUAL_REPOSITORY)
        private readonly accrualRepo: SalaryAccrualRepositoryPort,
        @Inject(SERVICE_ERP_CASH_DOCUMENT_PORT)
        private readonly erpPort: ErpCashDocumentPort,
        @Inject(PAYOUT_CASHBOX_RECORD_REPOSITORY)
        private readonly payoutCashboxRecordRepo: PayoutCashboxRecordRepositoryPort,
        @Inject(UNIT_OF_WORK)
        private readonly unitOfWork: UnitOfWorkPort,
        private readonly employeeLock: EmployeeOperationLock,
    ) {}

    async execute(command: DeletePayoutCommand): Promise<void> {
        const transaction = await this.transactionRepo.findById(
            command.payoutId,
        );
        if (!transaction) {
            throw new BalanceTransactionNotFoundException(command.payoutId);
        }
        if (
            transaction.type !== 'PAYOUT' ||
            transaction.direction !== 'service'
        ) {
            throw new BalanceTransactionNotPayoutException(
                transaction.id,
                'service',
            );
        }

        await this.employeeLock.runExclusive(transaction.employeeId, () =>
            this.deletePayout(transaction.id, transaction.employeeId),
        );
    }

    private async deletePayout(
        transactionId: string,
        employeeId: number,
    ): Promise<void> {
        const payoutCashboxRecord =
            await this.payoutCashboxRecordRepo.findByTransactionId(
                transactionId,
            );
        if (!payoutCashboxRecord) {
            throw new PayoutCashboxRecordMissingForTransactionException(
                transactionId,
            );
        }

        // Сначала ERP — отказ ничего не меняет (PRD 3).
        await this.erpPort.delete({
            externalId: payoutCashboxRecord.externalId,
            kind: payoutCashboxRecord.kind,
            amount: payoutCashboxRecord.amount,
        });

        try {
            await this.unitOfWork.run(async () => {
                await this.transactionRepo.deleteById(transactionId);
                await this.payoutCashboxRecordRepo.deleteById(
                    payoutCashboxRecord.id,
                );
                const paidAccruals = await this.accrualRepo.findPaidByEmployee(
                    'service',
                    employeeId,
                );
                for (const accrual of paidAccruals) {
                    accrual.revertToAccrued();
                    await this.accrualRepo.save(accrual);
                }
            });
        } catch (dbError) {
            // ERP уже удалила документ — компенсации в обратную сторону не
            // существует (тот же приём, что DeleteBalanceTransactionHandler):
            // состояние логируется для ручной сверки, исходная ошибка
            // пробрасывается как есть.
            this.logger.error(
                `Документ ERP ${payoutCashboxRecord.externalId} (выплата, ` +
                    `направление "service", движение ${transactionId}) удалён ` +
                    'в ERP, но запись об удалении в нашей БД не удалась — ' +
                    'требуется ручная сверка',
                dbError instanceof Error ? dbError.stack : String(dbError),
            );
            throw dbError;
        }
    }
}
