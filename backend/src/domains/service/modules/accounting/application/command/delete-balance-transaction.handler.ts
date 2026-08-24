import { Inject, Logger } from '@nestjs/common';
import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { UNIT_OF_WORK } from '@/shared/application/ports/unit-of-work.port';
import type { UnitOfWorkPort } from '@/shared/application/ports/unit-of-work.port';
import { EmployeeOperationLock } from '@/shared/infrastructure/sync-lock/employee-operation-lock';
import { BALANCE_TRANSACTION_REPOSITORY } from '@/domains/service/modules/accounting/application/ports/balance-transaction.port';
import type { BalanceTransactionRepositoryPort } from '@/domains/service/modules/accounting/application/ports/balance-transaction.port';
import { ERP_CASH_DOCUMENT_REPOSITORY } from '@/domains/service/modules/accounting/application/ports/erp-cash-document-repository.port';
import type { ErpCashDocumentRepositoryPort } from '@/domains/service/modules/accounting/application/ports/erp-cash-document-repository.port';
import { SERVICE_ERP_CASH_DOCUMENT_PORT } from '@/domains/service/modules/accounting/application/ports/erp-cash-document.port';
import type { ErpCashDocumentPort } from '@/domains/service/modules/accounting/application/ports/erp-cash-document.port';
import { SHOP_ERP_CASH_DOCUMENT_PORT } from '@/domains/shop/modules/accounting/application/ports/erp-cash-document.port';
import type { ErpCashDocumentPort as ShopErpCashDocumentPort } from '@/domains/shop/modules/accounting/application/ports/erp-cash-document.port';
import { BalanceTransactionNotFoundException } from '@/domains/service/modules/accounting/domain/exceptions/balance-transaction.exception';
import { ErpCashDocumentMissingForTransactionException } from '@/domains/service/modules/accounting/domain/exceptions/erp-cash.exception';
import type { AccountingDirection } from '@/shared/domain/calculation-context';
import { DeleteBalanceTransactionCommand } from './delete-balance-transaction.command';

// Удаление ошибочного ручного движения (PRD 2, Фаза 8b; касса ERP — PRD 3,
// Фаза 12 docs/payroll-closing-and-accrual/prd-salary-payout-and-erp-cash-documents.md,
// «Уточнение к PRD 2»): по решению пользователя лента не хранит историю
// ошибочных записей — движение удаляется, остаток пересчитывается сам
// собой (он — SUM ленты). Удаляются только ручные движения (проверка —
// BalanceTransaction.ensureDeletable, 409 для начисления/выплаты); движения
// начисления удаляются действием «Отменить начисление» строки документа,
// выплата — своим DELETE .../payout/:id.
//
// erpSyncRequired = false — как в Фазе 8b: просто удаление записи.
// erpSyncRequired = true (PRD 3): «Ручное движение с erpSyncRequired = true
// удаляется вместе с документом ERP (сначала ERP, потом движение)» —
// зеркально созданию (create-balance-transaction.handler.ts): сначала
// запрос в ERP, при успехе — движение и связка удаляются в одной
// транзакции; отказ ERP — ничего не меняется, ошибка возвращена. Повторный
// DELETE уже удалённого движения — 404 (записи больше нет).
@CommandHandler(DeleteBalanceTransactionCommand)
export class DeleteBalanceTransactionHandler implements ICommandHandler<
    DeleteBalanceTransactionCommand,
    void
> {
    private readonly logger = new Logger(DeleteBalanceTransactionHandler.name);

    constructor(
        @Inject(BALANCE_TRANSACTION_REPOSITORY)
        private readonly transactionRepo: BalanceTransactionRepositoryPort,
        @Inject(SERVICE_ERP_CASH_DOCUMENT_PORT)
        private readonly serviceErpCashPort: ErpCashDocumentPort,
        @Inject(SHOP_ERP_CASH_DOCUMENT_PORT)
        private readonly shopErpCashPort: ShopErpCashDocumentPort,
        @Inject(ERP_CASH_DOCUMENT_REPOSITORY)
        private readonly erpCashDocumentRepo: ErpCashDocumentRepositoryPort,
        @Inject(UNIT_OF_WORK)
        private readonly unitOfWork: UnitOfWorkPort,
        private readonly employeeLock: EmployeeOperationLock,
    ) {}

    async execute(command: DeleteBalanceTransactionCommand): Promise<void> {
        const transaction = await this.transactionRepo.findById(
            command.transactionId,
        );
        if (!transaction) {
            throw new BalanceTransactionNotFoundException(
                command.transactionId,
            );
        }

        transaction.ensureDeletable();

        if (!transaction.erpSyncRequired) {
            await this.transactionRepo.deleteById(transaction.id);
            return;
        }

        await this.employeeLock.runExclusive(transaction.employeeId, () =>
            this.deleteWithErpSync(transaction.id, transaction.direction),
        );
    }

    private async deleteWithErpSync(
        transactionId: string,
        direction: AccountingDirection,
    ): Promise<void> {
        const erpCashDocument =
            await this.erpCashDocumentRepo.findByTransactionId(transactionId);
        if (!erpCashDocument) {
            // «Либо есть оба, либо нет ни одного» (PRD 3, «Цель») — раз
            // движение erpSyncRequired существует без связки, это
            // рассинхронизация, а не штатный путь; см. WHY на исключении.
            throw new ErpCashDocumentMissingForTransactionException(
                transactionId,
            );
        }

        const erpPort = this.resolveErpCashPort(direction);
        // Сначала ERP — отказ ничего не меняет (PRD 3: «сначала удаление в
        // ERP, затем удаление движения; отказ ERP → ничего не удалено»).
        // BadGatewayException адаптера пробрасывается как есть.
        await erpPort.delete({
            externalId: erpCashDocument.externalId,
            kind: erpCashDocument.kind,
            amount: erpCashDocument.amount,
        });

        try {
            await this.unitOfWork.run(async () => {
                await this.transactionRepo.deleteById(transactionId);
                await this.erpCashDocumentRepo.deleteById(erpCashDocument.id);
            });
        } catch (dbError) {
            // ERP уже удалила документ, но наша БД не подтвердила это —
            // компенсации в обратную сторону («воссоздать документ в ERP»)
            // не существует ни в PRD 3, ни технически (create() создал бы
            // НОВЫЙ externalId, а не восстановил старый): состояние логируется
            // для ручной сверки, исходная ошибка пробрасывается как есть.
            this.logger.error(
                `Документ ERP ${erpCashDocument.externalId} (направление ` +
                    `"${direction}", движение ${transactionId}) удалён в ERP, ` +
                    'но запись об удалении в нашей БД не удалась — требуется ручная сверка',
                dbError instanceof Error ? dbError.stack : String(dbError),
            );
            throw dbError;
        }
    }

    private resolveErpCashPort(
        direction: AccountingDirection,
    ): ErpCashDocumentPort {
        return direction === 'service'
            ? this.serviceErpCashPort
            : this.shopErpCashPort;
    }
}
