import { Inject, Logger } from '@nestjs/common';
import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { UNIT_OF_WORK } from '@/shared/application/ports/unit-of-work.port';
import type { UnitOfWorkPort } from '@/shared/application/ports/unit-of-work.port';
import { EmployeeOperationLock } from '@/shared/infrastructure/sync-lock/employee-operation-lock';
import { BALANCE_TRANSACTION_REPOSITORY } from '@/domains/service/modules/accounting/application/ports/balance-transaction.port';
import type { BalanceTransactionRepositoryPort } from '@/domains/service/modules/accounting/application/ports/balance-transaction.port';
import { SALARY_ACCRUAL_REPOSITORY } from '@/domains/service/modules/accounting/application/ports/salary-accrual.port';
import type { SalaryAccrualRepositoryPort } from '@/domains/service/modules/accounting/application/ports/salary-accrual.port';
import { ERP_CASH_DOCUMENT_REPOSITORY } from '@/domains/service/modules/accounting/application/ports/erp-cash-document-repository.port';
import type { ErpCashDocumentRepositoryPort } from '@/domains/service/modules/accounting/application/ports/erp-cash-document-repository.port';
import { SHOP_ERP_CASH_DOCUMENT_PORT } from '@/domains/shop/modules/accounting/application/ports/erp-cash-document.port';
import type { ErpCashDocumentPort } from '@/domains/shop/modules/accounting/application/ports/erp-cash-document.port';
import { BalanceTransactionNotFoundException } from '@/domains/service/modules/accounting/domain/exceptions/balance-transaction.exception';
import { BalanceTransactionNotPayoutException } from '@/domains/service/modules/accounting/domain/exceptions/balance-transaction.exception';
import { ErpCashDocumentMissingForTransactionException } from '@/domains/service/modules/accounting/domain/exceptions/erp-cash.exception';
import { DeleteShopPayoutCommand } from './delete-shop-payout.command';

// Удаление выплаты направления shop (PRD 3, Фаза 12: «сначала удаляется
// документ в ERP, затем в одной транзакции — движение с баланса и возврат
// документов начисления из PAID в ACCRUED. Если ERP отказала в удалении —
// ничего не меняется... Сторно (PAYOUT_REVERSAL) для выплат не
// используется»). Зеркалит DeletePayoutHandler направления service (см.
// domains/service/modules/accounting/application/command/delete-payout.handler.ts),
// собственный класс: SHOP_ERP_CASH_DOCUMENT_PORT/МойСклад вместо
// SERVICE_ERP_CASH_DOCUMENT_PORT/RemOnline. BalanceTransactionNotFoundException/
// BalanceTransactionNotPayoutException/ErpCashDocumentMissingForTransactionException
// — переиспользованы из domains/service напрямую: это не бизнес-правило
// зарплаты магазина, а инварианты общей, direction-агностичной сущности
// BalanceTransaction/ErpCashDocument (см. WHY в CreateShopPayoutHandler и
// прецедент close-shop-accounting-period.handler.ts, реиспользующего
// исключения AccountingPeriod).
//
// "Затронутые" PAID-документы при откате — ВСЕ PAID-документы сотрудника
// направления shop (см. WHY на SalaryAccrualRepositoryPort.findPaidByEmployee):
// приближение, задокументированная граница, не точный обратный расчёт —
// тот же приём, что и у DeletePayoutHandler направления service.
@CommandHandler(DeleteShopPayoutCommand)
export class DeleteShopPayoutHandler implements ICommandHandler<
    DeleteShopPayoutCommand,
    void
> {
    private readonly logger = new Logger(DeleteShopPayoutHandler.name);

    constructor(
        @Inject(BALANCE_TRANSACTION_REPOSITORY)
        private readonly transactionRepo: BalanceTransactionRepositoryPort,
        @Inject(SALARY_ACCRUAL_REPOSITORY)
        private readonly accrualRepo: SalaryAccrualRepositoryPort,
        @Inject(SHOP_ERP_CASH_DOCUMENT_PORT)
        private readonly erpPort: ErpCashDocumentPort,
        @Inject(ERP_CASH_DOCUMENT_REPOSITORY)
        private readonly erpCashDocumentRepo: ErpCashDocumentRepositoryPort,
        @Inject(UNIT_OF_WORK)
        private readonly unitOfWork: UnitOfWorkPort,
        private readonly employeeLock: EmployeeOperationLock,
    ) {}

    async execute(command: DeleteShopPayoutCommand): Promise<void> {
        const transaction = await this.transactionRepo.findById(
            command.payoutId,
        );
        if (!transaction) {
            throw new BalanceTransactionNotFoundException(command.payoutId);
        }
        if (transaction.type !== 'PAYOUT' || transaction.direction !== 'shop') {
            throw new BalanceTransactionNotPayoutException(
                transaction.id,
                'shop',
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
        const erpCashDocument =
            await this.erpCashDocumentRepo.findByTransactionId(transactionId);
        if (!erpCashDocument) {
            throw new ErpCashDocumentMissingForTransactionException(
                transactionId,
            );
        }

        // Сначала ERP — отказ ничего не меняет (PRD 3).
        await this.erpPort.delete({
            externalId: erpCashDocument.externalId,
            kind: erpCashDocument.kind,
            amount: erpCashDocument.amount,
        });

        try {
            await this.unitOfWork.run(async () => {
                await this.transactionRepo.deleteById(transactionId);
                await this.erpCashDocumentRepo.deleteById(erpCashDocument.id);
                const paidAccruals = await this.accrualRepo.findPaidByEmployee(
                    'shop',
                    employeeId,
                );
                for (const accrual of paidAccruals) {
                    accrual.revertToAccrued();
                    await this.accrualRepo.save(accrual);
                }
            });
        } catch (dbError) {
            // ERP уже удалила документ — компенсации в обратную сторону не
            // существует (тот же приём, что DeleteBalanceTransactionHandler/
            // DeletePayoutHandler): состояние логируется для ручной сверки,
            // исходная ошибка пробрасывается как есть.
            this.logger.error(
                `Документ ERP ${erpCashDocument.externalId} (выплата, ` +
                    `направление "shop", движение ${transactionId}) удалён ` +
                    'в ERP, но запись об удалении в нашей БД не удалась — ' +
                    'требуется ручная сверка',
                dbError instanceof Error ? dbError.stack : String(dbError),
            );
            throw dbError;
        }
    }
}
