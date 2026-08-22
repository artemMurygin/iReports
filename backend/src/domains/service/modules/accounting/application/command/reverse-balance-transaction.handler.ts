import { Inject } from '@nestjs/common';
import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import type { BalanceTransaction as BalanceTransactionContract } from 'ireports-contracts';
import { BALANCE_TRANSACTION_REPOSITORY } from '@/domains/service/modules/accounting/application/ports/balance-transaction.port';
import type { BalanceTransactionRepositoryPort } from '@/domains/service/modules/accounting/application/ports/balance-transaction.port';
import { BalanceTransaction } from '@/domains/service/modules/accounting/domain/entities/balance-transaction.entity';
import {
    BalanceTransactionAlreadyReversedException,
    BalanceTransactionNotFoundException,
} from '@/domains/service/modules/accounting/domain/exceptions/balance-transaction.exception';
import { toBalanceTransactionResponse } from '../mappers/to-balance-transaction-response';
import { ReverseBalanceTransactionCommand } from './reverse-balance-transaction.command';

// Сторно ручного движения (PRD 2, Фаза 7): исходная запись остаётся в
// ленте с пометкой «сторнировано» (признак isReversed вычисляется на
// чтении — на движение ссылается MANUAL_REVERSAL), на баланс ложится
// движение-противоположность. Сторнируются только ручные движения без
// документа ERP (проверки — в BalanceTransaction.reversalOf, 409);
// повторное сторно — 409: прямой повтор ловится проверкой по ленте, гонку
// параллельных запросов — уникальное ограничение reversedTransactionId в
// БД (репозиторий мапит P2002 в тот же 409).
@CommandHandler(ReverseBalanceTransactionCommand)
export class ReverseBalanceTransactionHandler implements ICommandHandler<
    ReverseBalanceTransactionCommand,
    BalanceTransactionContract
> {
    constructor(
        @Inject(BALANCE_TRANSACTION_REPOSITORY)
        private readonly transactionRepo: BalanceTransactionRepositoryPort,
    ) {}

    async execute(
        command: ReverseBalanceTransactionCommand,
    ): Promise<BalanceTransactionContract> {
        const original = await this.transactionRepo.findById(
            command.transactionId,
        );
        if (!original || original.direction !== command.direction) {
            throw new BalanceTransactionNotFoundException(
                command.direction,
                command.transactionId,
            );
        }

        const reversedIds = await this.transactionRepo.findReversedIds([
            original.id,
        ]);
        if (reversedIds.has(original.id)) {
            throw new BalanceTransactionAlreadyReversedException(original.id);
        }

        const reversal = BalanceTransaction.reversalOf(
            original,
            command.comment,
            command.createdBy,
        );
        await this.transactionRepo.insertMany([reversal]);

        return toBalanceTransactionResponse(reversal, null, false);
    }
}
