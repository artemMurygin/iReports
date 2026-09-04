import { Inject, Logger } from '@nestjs/common';
import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import type { PayoutResponse } from 'ireports-contracts';
import { UNIT_OF_WORK } from '@/shared/application/ports/unit-of-work.port';
import type { UnitOfWorkPort } from '@/shared/application/ports/unit-of-work.port';
import { EmployeeOperationLock } from '@/shared/infrastructure/sync-lock/employee-operation-lock';
import { BALANCE_TRANSACTION_REPOSITORY } from '@/modules/employee-balance/application/ports/balance-transaction.port';
import type { BalanceTransactionRepositoryPort } from '@/modules/employee-balance/application/ports/balance-transaction.port';
import { SALARY_ACCRUAL_REPOSITORY } from '@/domains/service/modules/accounting/application/ports/salary-accrual/salary-accrual.port';
import type { SalaryAccrualRepositoryPort } from '@/domains/service/modules/accounting/application/ports/salary-accrual/salary-accrual.port';
import { PAYOUT_CASHBOX_RECORD_REPOSITORY } from '@/domains/service/modules/accounting/application/ports/payout-cashbox-record-repository.port';
import type { PayoutCashboxRecordRepositoryPort } from '@/domains/service/modules/accounting/application/ports/payout-cashbox-record-repository.port';
import { SERVICE_ERP_CASH_DOCUMENT_PORT } from '@/domains/service/modules/accounting/application/ports/erp-cash-document.port';
import type { ErpCashDocumentPort } from '@/domains/service/modules/accounting/application/ports/erp-cash-document.port';
import { DIRECTORY_REPOSITORY } from '@/modules/directory/application/ports/directory.port';
import type { DirectoryRepositoryPort } from '@/modules/directory/application/ports/directory.port';
import { BalanceTransaction } from '@/modules/employee-balance/domain/entities/balance-transaction.entity';
import { Cashbox } from '@/domains/service/modules/accounting/domain/entities/payout-cashbox-record.entity';
import { PayoutConfirmationRequiredException } from '@/modules/employee-balance/domain/exceptions/salary-payout.exception';
import {
    buildErpCashDocumentPurpose,
    erpSystemForDirection,
    resolveEmployeeDisplayName,
} from '@/modules/employee-balance/application/services/erp-cash-sync.helper';
import { toBalanceTransactionResponse } from '@/modules/employee-balance/application/mappers/to-balance-transaction-response';
import { PayoutCashboxRecordMapper } from '@/domains/service/modules/accounting/infrastructure/mappers/erp-cash/payout-cashbox-record.mapper';
import { CreatePayoutCommand } from './create-payout.command';

// Выплата направления service (PRD 3
// docs/payroll-closing-and-accrual/prd-salary-payout-and-erp-cash-documents.md,
// Фаза 12) — движение баланса типа PAYOUT (всегда расход, направление кассы
// — service/RemOnline) плюс связанный Cashbox, порядок «сначала ERP,
// затем БД» — тот же приём, что CreateBalanceTransactionHandler.createWithErpSync
// (erpSyncRequired: true), только без выбора между двумя портами: этот
// хендлер обслуживает ровно одно направление (SERVICE_ERP_CASH_DOCUMENT_PORT),
// эндпоинт уже несёт направление в пути.
//
// Блокировка по сотруднику (EmployeeOperationLock, ключ — employeeId, не
// пара direction+employeeId, см. WHY в employee-operation-lock.ts) —
// «чтобы два руководителя не провели две операции одновременно» (PRD 3):
// обёрнута вокруг ВСЕЙ операции, включая чтение текущего остатка, — иначе
// два параллельных запроса прочитали бы один и тот же остаток до того, как
// первый его изменит, и оба создали бы выплату без запроса подтверждения
// там, где по факту она требовалась.
@CommandHandler(CreatePayoutCommand)
export class CreatePayoutHandler implements ICommandHandler<
    CreatePayoutCommand,
    PayoutResponse
> {
    private readonly logger = new Logger(CreatePayoutHandler.name);
    private readonly payoutCashboxRecordMapper =
        new PayoutCashboxRecordMapper();

    constructor(
        @Inject(BALANCE_TRANSACTION_REPOSITORY)
        private readonly transactionRepo: BalanceTransactionRepositoryPort,
        @Inject(SALARY_ACCRUAL_REPOSITORY)
        private readonly accrualRepo: SalaryAccrualRepositoryPort,
        @Inject(SERVICE_ERP_CASH_DOCUMENT_PORT)
        private readonly erpPort: ErpCashDocumentPort,
        @Inject(PAYOUT_CASHBOX_RECORD_REPOSITORY)
        private readonly payoutCashboxRecordRepo: PayoutCashboxRecordRepositoryPort,
        @Inject(DIRECTORY_REPOSITORY)
        private readonly directoryRepo: DirectoryRepositoryPort,
        @Inject(UNIT_OF_WORK)
        private readonly unitOfWork: UnitOfWorkPort,
        private readonly employeeLock: EmployeeOperationLock,
    ) {}

    async execute(command: CreatePayoutCommand): Promise<PayoutResponse> {
        return this.employeeLock.runExclusive(command.employeeId, () =>
            this.createPayout(command),
        );
    }

    private async createPayout(
        command: CreatePayoutCommand,
    ): Promise<PayoutResponse> {
        // Остаток общий по сотруднику (PRD 2) — читается внутри блокировки,
        // чтобы решение «нужно ли подтверждение» и итоговая запись видели
        // одно и то же значение (см. WHY в шапке файла).
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
            direction: 'service',
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

        const payoutCashboxRecordEntity = Cashbox.createPayout({
            transactionId: transaction.id,
            system: erpSystemForDirection('service'),
            kind: 'OUTCOME',
            amount: Math.abs(transaction.amount),
            externalId: erpDocument.externalId,
        });

        try {
            await this.unitOfWork.run(async () => {
                await this.transactionRepo.insertMany([transaction]);
                await this.payoutCashboxRecordRepo.insert(
                    payoutCashboxRecordEntity,
                );
                // «Документы... в статусе ACCRUED переходят в PAID, когда
                // остаток баланса после операции ≤ 0» (PRD 3) — только
                // документы СВОЕГО направления (см. WHY на
                // SalaryAccrual.markPaid): выплата service не может
                // обращаться к репозиторию shop напрямую (изоляция доменов,
                // backend/CLAUDE.md).
                if (balanceAfter <= 0) {
                    const accruals =
                        await this.accrualRepo.findAccruedByEmployee(
                            'service',
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
            // сверки (тот же приём, что CreateBalanceTransactionHandler).
            try {
                await this.erpPort.delete({
                    externalId: erpDocument.externalId,
                    kind: 'OUTCOME',
                    amount: Math.abs(transaction.amount),
                });
            } catch (compensationError) {
                this.logger.error(
                    `Компенсация не удалась: документ ERP ${erpDocument.externalId} ` +
                        `(выплата, направление "service", движение ${transaction.id}) ` +
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
                system: payoutCashboxRecordEntity.system,
                externalId: payoutCashboxRecordEntity.externalId,
            }),
            erpDocument: this.payoutCashboxRecordMapper.toResponse(
                payoutCashboxRecordEntity,
            ),
        };
    }
}
