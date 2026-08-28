import { Inject, Logger } from '@nestjs/common';
import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import type { PayoutResponse } from 'ireports-contracts';
import { UNIT_OF_WORK } from '@/shared/application/ports/unit-of-work.port';
import type { UnitOfWorkPort } from '@/shared/application/ports/unit-of-work.port';
import { EmployeeOperationLock } from '@/shared/infrastructure/sync-lock/employee-operation-lock';
import { BALANCE_TRANSACTION_REPOSITORY } from '@/modules/employee-balance/application/ports/balance-transaction.port';
import type { BalanceTransactionRepositoryPort } from '@/modules/employee-balance/application/ports/balance-transaction.port';
import { SHOP_SALARY_ACCRUAL_REPOSITORY } from '@/domains/shop/modules/accounting/application/ports/shop-salary-accrual.port';
import type { ShopSalaryAccrualRepositoryPort } from '@/domains/shop/modules/accounting/application/ports/shop-salary-accrual.port';
import { SHOP_ERP_CASH_DOCUMENT_REPOSITORY } from '@/domains/shop/modules/accounting/application/ports/shop-erp-cash-document-repository.port';
import type { ShopErpCashDocumentRepositoryPort } from '@/domains/shop/modules/accounting/application/ports/shop-erp-cash-document-repository.port';
import { SHOP_ERP_CASH_DOCUMENT_PORT } from '@/domains/shop/modules/accounting/application/ports/erp-cash-document.port';
import type { ErpCashDocumentPort } from '@/domains/shop/modules/accounting/application/ports/erp-cash-document.port';
import { DIRECTORY_REPOSITORY } from '@/modules/directory/application/ports/directory.port';
import type { DirectoryRepositoryPort } from '@/modules/directory/application/ports/directory.port';
import { BalanceTransaction } from '@/modules/employee-balance/domain/entities/balance-transaction.entity';
import { ShopErpCashDocument } from '@/domains/shop/modules/accounting/domain/entities/shop-erp-cash-document.entity';
import { PayoutConfirmationRequiredException } from '@/modules/employee-balance/domain/exceptions/salary-payout.exception';
import {
    buildErpCashDocumentPurpose,
    erpSystemForDirection,
    resolveEmployeeDisplayName,
} from '@/modules/employee-balance/application/services/erp-cash-sync.helper';
import { toBalanceTransactionResponse } from '@/modules/employee-balance/application/mappers/to-balance-transaction-response';
import { toShopErpCashDocumentResponse } from '@/domains/shop/modules/accounting/application/mappers/to-shop-erp-cash-document-response';
import { CreateShopPayoutCommand } from './create-shop-payout.command';

// Выплата направления shop (PRD 3
// docs/payroll-closing-and-accrual/prd-salary-payout-and-erp-cash-documents.md,
// Фаза 12) — зеркалит CreatePayoutHandler направления service (см.
// domains/service/modules/accounting/application/command/create-payout.handler.ts),
// но собственный класс: SHOP_ERP_CASH_DOCUMENT_PORT/МойСклад вместо
// SERVICE_ERP_CASH_DOCUMENT_PORT/RemOnline (модули не переиспользуют
// бизнес-код друг друга, backend/CLAUDE.md, domains/shop/CLAUDE.md).
// SHOP_ERP_CASH_DOCUMENT_REPOSITORY/ShopErpCashDocument/toShopErpCashDocumentResponse
// — собственные независимые классы shop (Фаза 4
// docs/service-shop-boundary-violations-fix — до этой фазы переиспользовали
// ERP_CASH_DOCUMENT_REPOSITORY/ErpCashDocument/toErpCashDocumentResponse
// domains/service напрямую, см. §2.1 docs/service-shop-boundary-violations.md).
// BALANCE_TRANSACTION_REPOSITORY — сквозной employee-balance (баланс общий
// по сотруднику — PRD 2). SHOP_SALARY_ACCRUAL_REPOSITORY — с Фазы 6
// docs/service-shop-boundary-violations-fix собственный независимый
// токен/класс domains/shop (не переиспользует SALARY_ACCRUAL_REPOSITORY
// сервиса). PayoutConfirmationRequiredException/erp-cash-sync.helper —
// по-прежнему импортированы напрямую из domains/service: они завязаны на
// форму BalanceTransaction/остаток, а не на конкретную ERP или SalaryAccrual
// одного направления — не бизнес-логика, требующая раздельной реализации.
//
// Блокировка по сотруднику — см. WHY в CreatePayoutHandler (обёрнута вокруг
// ВСЕЙ операции, включая чтение остатка, чтобы два параллельных запроса не
// прочитали один и тот же остаток до того, как первый его изменит).
@CommandHandler(CreateShopPayoutCommand)
export class CreateShopPayoutHandler implements ICommandHandler<
    CreateShopPayoutCommand,
    PayoutResponse
> {
    private readonly logger = new Logger(CreateShopPayoutHandler.name);

    constructor(
        @Inject(BALANCE_TRANSACTION_REPOSITORY)
        private readonly transactionRepo: BalanceTransactionRepositoryPort,
        @Inject(SHOP_SALARY_ACCRUAL_REPOSITORY)
        private readonly accrualRepo: ShopSalaryAccrualRepositoryPort,
        @Inject(SHOP_ERP_CASH_DOCUMENT_PORT)
        private readonly erpPort: ErpCashDocumentPort,
        @Inject(SHOP_ERP_CASH_DOCUMENT_REPOSITORY)
        private readonly erpCashDocumentRepo: ShopErpCashDocumentRepositoryPort,
        @Inject(DIRECTORY_REPOSITORY)
        private readonly directoryRepo: DirectoryRepositoryPort,
        @Inject(UNIT_OF_WORK)
        private readonly unitOfWork: UnitOfWorkPort,
        private readonly employeeLock: EmployeeOperationLock,
    ) {}

    async execute(command: CreateShopPayoutCommand): Promise<PayoutResponse> {
        return this.employeeLock.runExclusive(command.employeeId, () =>
            this.createPayout(command),
        );
    }

    private async createPayout(
        command: CreateShopPayoutCommand,
    ): Promise<PayoutResponse> {
        // Остаток общий по сотруднику (PRD 2) — читается внутри блокировки
        // (см. WHY в шапке файла).
        const balance = await this.transactionRepo.sumByEmployee(
            command.employeeId,
        );
        const balanceAfter = balance - command.amount;
        const needsConfirmation = balance <= 0 || command.amount > balance;
        if (needsConfirmation && !command.confirmNegativeBalance) {
            throw new PayoutConfirmationRequiredException(
                command.employeeId,
                balance,
                balanceAfter,
            );
        }

        const transaction = BalanceTransaction.forPayout({
            employeeId: command.employeeId,
            direction: 'shop',
            amount: command.amount,
            createdBy: command.createdBy,
            comment: command.comment,
            occurredAt: command.occurredAt,
        });

        const employeeName = await resolveEmployeeDisplayName(
            this.directoryRepo,
            command.employeeId,
        );
        const purpose = buildErpCashDocumentPurpose(
            transaction.type,
            transaction.period,
            employeeName,
        );

        // Сначала ERP — до записи чего бы то ни было в нашу БД (PRD 3:
        // «Порядок операции синхронный, всё или ничего»). Выплата — всегда
        // расход кассы (OUTCOME).
        const erpDocument = await this.erpPort.create({
            transactionId: transaction.id,
            amount: Math.abs(transaction.amount),
            kind: 'OUTCOME',
            employeeId: command.employeeId,
            purpose,
            occurredAt: transaction.occurredAt,
        });

        const erpCashDocumentEntity = ShopErpCashDocument.create({
            transactionId: transaction.id,
            system: erpSystemForDirection('shop'),
            kind: 'OUTCOME',
            amount: Math.abs(transaction.amount),
            externalId: erpDocument.externalId,
        });

        try {
            await this.unitOfWork.run(async () => {
                await this.transactionRepo.insertMany([transaction]);
                await this.erpCashDocumentRepo.insert(erpCashDocumentEntity);
                // «Документы... в статусе ACCRUED переходят в PAID, когда
                // остаток баланса после операции ≤ 0» (PRD 3) — только
                // документы СВОЕГО направления (см. WHY на
                // SalaryAccrual.markPaid): выплата shop не может обращаться
                // к репозиторию service напрямую (изоляция доменов,
                // backend/CLAUDE.md).
                if (balanceAfter <= 0) {
                    const accruals =
                        await this.accrualRepo.findAccruedByEmployee(
                            command.employeeId,
                        );
                    for (const accrual of accruals) {
                        accrual.markPaid();
                        await this.accrualRepo.save(accrual);
                    }
                }
            });
        } catch (dbError) {
            // Компенсация (PRD 3): ERP уже создала документ, но запись в
            // нашу БД не удалась — документ ERP удаляется, и только потом
            // возвращается исходная ошибка; неудача компенсации не
            // маскирует исходную ошибку, только логируется для ручной
            // сверки (тот же приём, что CreateBalanceTransactionHandler/
            // CreatePayoutHandler).
            try {
                await this.erpPort.delete({
                    externalId: erpDocument.externalId,
                    kind: 'OUTCOME',
                    amount: Math.abs(transaction.amount),
                });
            } catch (compensationError) {
                this.logger.error(
                    `Компенсация не удалась: документ ERP ${erpDocument.externalId} ` +
                        `(выплата, направление "shop", движение ${transaction.id}) ` +
                        'не удалён после сбоя записи в БД — требуется ручная сверка',
                    compensationError instanceof Error
                        ? compensationError.stack
                        : String(compensationError),
                );
            }
            throw dbError;
        }

        return {
            transaction: toBalanceTransactionResponse(transaction, {
                system: erpCashDocumentEntity.system,
                externalId: erpCashDocumentEntity.externalId,
            }),
            erpDocument: toShopErpCashDocumentResponse(erpCashDocumentEntity),
        };
    }
}
