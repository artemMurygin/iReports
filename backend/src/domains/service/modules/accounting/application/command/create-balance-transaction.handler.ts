import { Inject, Logger } from '@nestjs/common';
import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import type { BalanceTransaction as BalanceTransactionContract } from 'ireports-contracts';
import { UNIT_OF_WORK } from '@/shared/application/ports/unit-of-work.port';
import type { UnitOfWorkPort } from '@/shared/application/ports/unit-of-work.port';
import { EmployeeOperationLock } from '@/shared/infrastructure/sync-lock/employee-operation-lock';
import { BALANCE_TRANSACTION_REPOSITORY } from '@/domains/service/modules/accounting/application/ports/balance-transaction.port';
import type { BalanceTransactionRepositoryPort } from '@/domains/service/modules/accounting/application/ports/balance-transaction.port';
import { SALARY_ACCRUAL_REPOSITORY } from '@/domains/service/modules/accounting/application/ports/salary-accrual.port';
import type { SalaryAccrualRepositoryPort } from '@/domains/service/modules/accounting/application/ports/salary-accrual.port';
import { ERP_CASH_DOCUMENT_REPOSITORY } from '@/domains/service/modules/accounting/application/ports/erp-cash-document-repository.port';
import type { ErpCashDocumentRepositoryPort } from '@/domains/service/modules/accounting/application/ports/erp-cash-document-repository.port';
import { SERVICE_ERP_CASH_DOCUMENT_PORT } from '@/domains/service/modules/accounting/application/ports/erp-cash-document.port';
import type { ErpCashDocumentPort } from '@/domains/service/modules/accounting/application/ports/erp-cash-document.port';
import { SHOP_ERP_CASH_DOCUMENT_PORT } from '@/domains/shop/modules/accounting/application/ports/erp-cash-document.port';
import type { ErpCashDocumentPort as ShopErpCashDocumentPort } from '@/domains/shop/modules/accounting/application/ports/erp-cash-document.port';
import { DIRECTORY_REPOSITORY } from '@/modules/directory/application/ports/directory.port';
import type { DirectoryRepositoryPort } from '@/modules/directory/application/ports/directory.port';
import { BalanceTransaction } from '@/domains/service/modules/accounting/domain/entities/balance-transaction.entity';
import { ErpCashDocument } from '@/domains/service/modules/accounting/domain/entities/erp-cash-document.entity';
import type { AccountingDirection } from '@/shared/domain/calculation-context';
import {
    buildErpCashDocumentPurpose,
    erpSystemForDirection,
    resolveEmployeeDisplayName,
} from '../services/erp-cash-sync.helper';
import { toBalanceTransactionResponse } from '../mappers/to-balance-transaction-response';
import { CreateBalanceTransactionCommand } from './create-balance-transaction.command';

// Ручное движение руководителя (PRD 2, Фаза 7; касса ERP — PRD 3, Фаза 12
// docs/payroll-closing-and-accrual/prd-salary-payout-and-erp-cash-documents.md):
// единственный способ провести деньги мимо документов начисления. Знак —
// по типу, для ADJUSTMENT — явно; обязательный комментарий для PENALTY/
// ADJUSTMENT проверяется контрактом (400 на границе HTTP) и в домене
// (BalanceTransaction.validate). Дата задним числом разрешена — движение с
// датой внутри закрытого месяца просто записывается в ленту: снапшот и
// документы начисления закрытого периода этот путь не читает и не меняет.
// Лимитов на аванс нет — остаток не проверяется, отрицательный баланс —
// штатная ситуация.
//
// erpSyncRequired = false — как в Фазе 7/8b: просто запись, ни один из
// портов ERP ниже не вызывается. erpSyncRequired = true (PRD 3, «Уточнение
// к PRD 2»): порядок «сначала запрос в ERP, успех → запись движения и
// связки ErpCashDocument в одной транзакции; ошибка ERP → ничего не
// записано; успех ERP + сбой БД → компенсация (удаление документа ERP),
// потом исходная ошибка» — тот же порядок, что и у обработчика выплаты
// (CreatePayoutHandler), здесь применён к ручному движению.
//
// PAID по остатку (PRD 3, «В скоупе»): «Документы начисления... переходят в
// PAID, когда остаток баланса после операции ≤ 0 — независимо от того, чем
// он закрыт: выплатой, РУЧНЫМ ПРИХОДОМ (возврат аванса) или их
// комбинацией» — критерий готовности прямо требует тест «на оба способа
// закрытия». Значит, ЛЮБОЕ ручное движение (не только erpSyncRequired: true)
// обязано выполнять ту же проверку/переход, что и CreatePayoutHandler —
// см. markAccrualsPaidIfSettled ниже, вызывается из обеих ветвей (create*).
// Только документы СВОЕГО направления (см. WHY на SalaryAccrual.markPaid) —
// движение не обращается к репозиторию другого домена (изоляция доменов,
// backend/CLAUDE.md).
//
// Блокировка по сотруднику — теперь вокруг ВСЕЙ команды (обе ветви), не
// только erpSyncRequired: true: чтение остатка и переход документов в PAID
// должны видеть согласованное состояние даже без обращения к ERP (PRD 3,
// «Технические ограничения»: «Блокировка по сотруднику на время операции
// выплаты/удаления, чтобы два руководителя не провели две операции
// одновременно» — тот же риск гонки применим к двум параллельным ручным
// движениям, закрывающим один и тот же остаток).
//
// Оба порта ERP (SERVICE_/SHOP_ERP_CASH_DOCUMENT_PORT) инжектированы сразу
// — команда/эндпоинт баланса общие на оба направления (Фаза 8b), а выбор
// адаптера зависит от command.direction, известного только на вызове. Это
// то же осознанное исключение из изоляции доменов service/shop, что уже
// существует у самого баланса (BALANCE_TRANSACTION_REPOSITORY — один
// хендлер на оба домена); WHY подробно — в accounting.module.ts, там же, где
// оба токена реально забинжены.
@CommandHandler(CreateBalanceTransactionCommand)
export class CreateBalanceTransactionHandler implements ICommandHandler<
    CreateBalanceTransactionCommand,
    BalanceTransactionContract
> {
    private readonly logger = new Logger(CreateBalanceTransactionHandler.name);

    constructor(
        @Inject(BALANCE_TRANSACTION_REPOSITORY)
        private readonly transactionRepo: BalanceTransactionRepositoryPort,
        @Inject(SALARY_ACCRUAL_REPOSITORY)
        private readonly accrualRepo: SalaryAccrualRepositoryPort,
        @Inject(SERVICE_ERP_CASH_DOCUMENT_PORT)
        private readonly serviceErpCashPort: ErpCashDocumentPort,
        @Inject(SHOP_ERP_CASH_DOCUMENT_PORT)
        private readonly shopErpCashPort: ShopErpCashDocumentPort,
        @Inject(ERP_CASH_DOCUMENT_REPOSITORY)
        private readonly erpCashDocumentRepo: ErpCashDocumentRepositoryPort,
        @Inject(DIRECTORY_REPOSITORY)
        private readonly directoryRepo: DirectoryRepositoryPort,
        @Inject(UNIT_OF_WORK)
        private readonly unitOfWork: UnitOfWorkPort,
        private readonly employeeLock: EmployeeOperationLock,
    ) {}

    async execute(
        command: CreateBalanceTransactionCommand,
    ): Promise<BalanceTransactionContract> {
        // Блокировка по сотруднику — вокруг ВСЕЙ операции, обе ветви (см.
        // WHY в шапке файла): и чтение остатка/переход в PAID без ERP, и
        // синхронная запись в кассу ERP делят один и тот же общий баланс
        // сотрудника, два параллельных запроса не должны видеть остаток до
        // того, как первый его изменит.
        return this.employeeLock.runExclusive(command.employeeId, () =>
            command.erpSyncRequired
                ? this.createWithErpSync(command)
                : this.createManualOnly(command),
        );
    }

    private async createManualOnly(
        command: CreateBalanceTransactionCommand,
    ): Promise<BalanceTransactionContract> {
        const transaction = BalanceTransaction.createManual({
            employeeId: command.employeeId,
            direction: command.direction,
            type: command.type,
            amount: command.amount,
            occurredAt: command.occurredAt,
            createdBy: command.createdBy,
            comment: command.comment,
            period: command.period,
            erpSyncRequired: false,
        });

        // Остаток общий по сотруднику (PRD 2) — читается внутри блокировки
        // (см. WHY в шапке файла), чтобы PAID-переход ниже видел то же
        // значение, что решение о записи движения.
        const balanceAfter =
            (await this.transactionRepo.sumByEmployee(command.employeeId)) +
            transaction.amount;

        await this.unitOfWork.run(async () => {
            await this.transactionRepo.insertMany([transaction]);
            await this.markAccrualsPaidIfSettled(
                command.direction,
                command.employeeId,
                balanceAfter,
            );
        });

        return toBalanceTransactionResponse(transaction);
    }

    private async createWithErpSync(
        command: CreateBalanceTransactionCommand,
    ): Promise<BalanceTransactionContract> {
        const transaction = BalanceTransaction.createManual({
            employeeId: command.employeeId,
            direction: command.direction,
            type: command.type,
            amount: command.amount,
            occurredAt: command.occurredAt,
            createdBy: command.createdBy,
            comment: command.comment,
            period: command.period,
            erpSyncRequired: true,
        });
        const balanceAfter =
            (await this.transactionRepo.sumByEmployee(command.employeeId)) +
            transaction.amount;

        const erpPort = this.resolveErpCashPort(command.direction);
        const kind = transaction.amount >= 0 ? 'INCOME' : 'OUTCOME';
        const employeeName = await resolveEmployeeDisplayName(
            this.directoryRepo,
            command.employeeId,
        );
        const purpose = buildErpCashDocumentPurpose(
            transaction.type,
            transaction.period,
            employeeName,
        );

        // Сначала запрос в ERP — до записи чего бы то ни было в нашу БД
        // (PRD 3, «Технические ограничения»: «Порядок операции синхронный,
        // всё или ничего»). Ошибка ERP (BadGatewayException адаптера) или
        // отклонение до обращения в ERP (ErpCashConfigMissingException/
        // EmployeeErpIdentityMissingException и их shop-аналоги —
        // ConflictException) пробрасываются как есть, движение не создано.
        const erpDocument = await erpPort.create({
            transactionId: transaction.id,
            amount: Math.abs(transaction.amount),
            kind,
            employeeId: command.employeeId,
            purpose,
            occurredAt: transaction.occurredAt,
        });

        const erpCashDocumentEntity = ErpCashDocument.create({
            transactionId: transaction.id,
            system: erpSystemForDirection(command.direction),
            kind,
            amount: Math.abs(transaction.amount),
            externalId: erpDocument.externalId,
        });

        try {
            await this.unitOfWork.run(async () => {
                await this.transactionRepo.insertMany([transaction]);
                await this.erpCashDocumentRepo.insert(erpCashDocumentEntity);
                await this.markAccrualsPaidIfSettled(
                    command.direction,
                    command.employeeId,
                    balanceAfter,
                );
            });
        } catch (dbError) {
            // Компенсация (PRD 3): ERP уже создала документ, но запись в
            // нашу БД не удалась — документ ERP удаляется, и только потом
            // возвращается исходная ошибка. Неудача самой компенсации не
            // должна замаскировать исходную ошибку — она только логируется
            // с внешним ID для ручной сверки (PRD 3, «Технические
            // ограничения»: «единственный случай, когда системы могут
            // разойтись»).
            try {
                await erpPort.delete({
                    externalId: erpDocument.externalId,
                    kind,
                    amount: Math.abs(transaction.amount),
                });
            } catch (compensationError) {
                this.logger.error(
                    `Компенсация не удалась: документ ERP ${erpDocument.externalId} ` +
                        `(направление "${command.direction}", движение ${transaction.id}) ` +
                        'не удалён после сбоя записи в БД — требуется ручная сверка',
                    compensationError instanceof Error
                        ? compensationError.stack
                        : String(compensationError),
                );
            }
            throw dbError;
        }

        return toBalanceTransactionResponse(transaction, {
            system: erpCashDocumentEntity.system,
            externalId: erpCashDocumentEntity.externalId,
        });
    }

    private resolveErpCashPort(
        direction: AccountingDirection,
    ): ErpCashDocumentPort {
        return direction === 'service'
            ? this.serviceErpCashPort
            : this.shopErpCashPort;
    }

    // «Документы... в ACCRUED переходят в PAID, когда остаток баланса после
    // операции ≤ 0 — независимо от того, чем он закрыт: выплатой, ручным
    // приходом... или их комбинацией» (PRD 3, «В скоупе») — тот же переход,
    // что CreatePayoutHandler делает для выплаты, здесь применён к ручному
    // движению (единственная разница — выплата всегда уменьшает остаток,
    // ручное движение может как уменьшать, так и увеличивать его: критерий
    // «≤ 0» отфильтровывает случай сам по себе). Только документы СВОЕГО
    // направления — см. WHY на SalaryAccrual.markPaid.
    private async markAccrualsPaidIfSettled(
        direction: AccountingDirection,
        employeeId: number,
        balanceAfter: number,
    ): Promise<void> {
        if (balanceAfter > 0) {
            return;
        }
        const accruals = await this.accrualRepo.findAccruedByEmployee(
            direction,
            employeeId,
        );
        for (const accrual of accruals) {
            accrual.markPaid();
            await this.accrualRepo.save(accrual);
        }
    }
}
