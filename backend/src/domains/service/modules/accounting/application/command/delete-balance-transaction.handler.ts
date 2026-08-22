import { Inject } from '@nestjs/common';
import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { BALANCE_TRANSACTION_REPOSITORY } from '@/domains/service/modules/accounting/application/ports/balance-transaction.port';
import type { BalanceTransactionRepositoryPort } from '@/domains/service/modules/accounting/application/ports/balance-transaction.port';
import { BalanceTransactionNotFoundException } from '@/domains/service/modules/accounting/domain/exceptions/balance-transaction.exception';
import { DeleteBalanceTransactionCommand } from './delete-balance-transaction.command';

// Удаление ошибочного ручного движения (PRD 2, Фаза 8b): по решению
// пользователя лента не хранит историю ошибочных записей — движение
// удаляется, остаток пересчитывается сам собой (он — SUM ленты).
// Удаляются только ручные движения без документа ERP (проверки — в
// BalanceTransaction.ensureDeletable, 409): движения начисления удаляются
// действием «Отменить начисление» строки документа, выплата и движения с
// erpSyncRequired — вместе с документом ERP (PRD 3). Повторный DELETE
// уже удалённого движения — 404 (записи больше нет).
@CommandHandler(DeleteBalanceTransactionCommand)
export class DeleteBalanceTransactionHandler implements ICommandHandler<
    DeleteBalanceTransactionCommand,
    void
> {
    constructor(
        @Inject(BALANCE_TRANSACTION_REPOSITORY)
        private readonly transactionRepo: BalanceTransactionRepositoryPort,
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

        await this.transactionRepo.deleteById(transaction.id);
    }
}
