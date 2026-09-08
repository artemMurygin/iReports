import { Inject, Logger } from '@nestjs/common';
import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { UNIT_OF_WORK } from '@/shared/application/ports/unit-of-work.port';
import type { UnitOfWorkPort } from '@/shared/application/ports/unit-of-work.port';
import { EmployeeOperationLock } from '@/shared/infrastructure/sync-lock/employee-operation-lock';
import { BALANCE_TRANSACTION_REPOSITORY } from '@/modules/employee-balance/application/ports/balance-transaction.port';
import type { BalanceTransactionRepositoryPort } from '@/modules/employee-balance/application/ports/balance-transaction.port';
import { SHOP_SALARY_ACCRUAL_REPOSITORY } from '@/domains/shop/modules/accounting/application/ports/salary-accrual/salary-accrual.port';
import type { ShopSalaryAccrualRepositoryPort } from '@/domains/shop/modules/accounting/application/ports/salary-accrual/salary-accrual.port';
import { SHOP_PAYOUT_CASHBOX_RECORD_REPOSITORY } from '@/domains/shop/modules/accounting/application/ports/cashbox/payout-cashbox-record-repository.port';
import type { PayoutCashboxRecordRepositoryPort } from '@/domains/shop/modules/accounting/application/ports/cashbox/payout-cashbox-record-repository.port';
import { SHOP_ERP_CASH_DOCUMENT_PORT } from '@/domains/shop/modules/accounting/application/ports/cashbox/cashbox-document.port';
import type { ErpCashDocumentPort } from '@/domains/shop/modules/accounting/application/ports/cashbox/cashbox-document.port';
import { BalanceTransactionNotFoundException } from '@/modules/employee-balance/domain/exceptions/balance-transaction.exception';
import { BalanceTransactionNotPayoutException } from '@/modules/employee-balance/domain/exceptions/balance-transaction.exception';
import { PayoutCashboxRecordMissingForTransactionException } from '@/domains/shop/modules/accounting/domain/exceptions/cashbox.exception';
import { DeleteShopPayoutCommand } from './delete-payout.command';

// Удаление выплаты направления shop (PRD 3, Фаза 12: «сначала удаляется
// документ в ERP, затем в одной транзакции — движение с баланса и возврат
// документов начисления из PAID в ACCRUED. Если ERP отказала в удалении —
// ничего не меняется... Сторно (PAYOUT_REVERSAL) для выплат не
// используется»). Зеркалит DeletePayoutHandler направления service (см.
// domains/service/modules/accounting/application/command/delete-payout.handler.ts),
// собственный класс: SHOP_ERP_CASH_DOCUMENT_PORT/МойСклад вместо
// SERVICE_ERP_CASH_DOCUMENT_PORT/RemOnline. SHOP_PAYOUT_CASHBOX_RECORD_REPOSITORY/
// PayoutCashboxRecordMissingForTransactionException — собственные
// независимые классы shop (Фаза 4 docs/service-shop-boundary-violations-fix
// — до этой фазы переиспользовали ERP_CASH_DOCUMENT_REPOSITORY/
// ErpCashDocumentMissingForTransactionException domains/service напрямую,
// см. §2.1 docs/service-shop-boundary-violations.md).
// BalanceTransactionNotFoundException/BalanceTransactionNotPayoutException —
// по-прежнему переиспользованы напрямую (сквозной модуль employee-balance,
// не domains/service): это не бизнес-правило зарплаты магазина, а
// инварианты общей, direction-агностичной сущности BalanceTransaction (см.
// WHY в CreateShopPayoutHandler). SHOP_SALARY_ACCRUAL_REPOSITORY — с Фазы 6
// docs/service-shop-boundary-violations-fix собственный независимый
// токен/класс domains/shop.
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
        @Inject(SHOP_SALARY_ACCRUAL_REPOSITORY)
        private readonly accrualRepo: ShopSalaryAccrualRepositoryPort,
        @Inject(SHOP_ERP_CASH_DOCUMENT_PORT)
        private readonly erpPort: ErpCashDocumentPort,
        @Inject(SHOP_PAYOUT_CASHBOX_RECORD_REPOSITORY)
        private readonly payoutCashboxRecordRepo: PayoutCashboxRecordRepositoryPort,
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
                const paidAccruals =
                    await this.accrualRepo.findPaidByEmployee(employeeId);
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
                `Документ ERP ${payoutCashboxRecord.externalId} (выплата, ` +
                    `направление "shop", движение ${transactionId}) удалён ` +
                    'в ERP, но запись об удалении в нашей БД не удалась — ' +
                    'требуется ручная сверка',
                dbError instanceof Error ? dbError.stack : String(dbError),
            );
            throw dbError;
        }
    }
}
