import { BadGatewayException, Inject, Injectable } from '@nestjs/common';
import { RoappHttpService } from './roapp.instace';
import { toErrorMessage, toRoappIsoDate } from './roapp.service';
import { FinanceTransactionSchema } from './schemas/financeTransaction.schema';
import { DatabaseService } from '@/infrustructure/database/database.service';
import { ERP_CASH_CONFIG_REPOSITORY } from '@/domains/service/modules/accounting/application/ports/erp-cash-config.port';
import type { ErpCashConfigRepositoryPort } from '@/domains/service/modules/accounting/application/ports/erp-cash-config.port';
import { ERP_CASH_DOCUMENT_REPOSITORY } from '@/domains/service/modules/accounting/application/ports/erp-cash-document-repository.port';
import type { ErpCashDocumentRepositoryPort } from '@/domains/service/modules/accounting/application/ports/erp-cash-document-repository.port';
import type {
    CreateErpCashDocumentParams,
    DeleteErpCashDocumentParams,
    ErpCashDocumentPort,
    FoundErpCashDocument,
} from '@/domains/service/modules/accounting/application/ports/erp-cash-document.port';
import {
    EmployeeErpIdentityMissingException,
    ErpCashConfigMissingException,
} from '@/domains/service/modules/accounting/domain/exceptions/erp-cash.exception';

// Таймаут запроса к ERP (PRD 3
// docs/payroll-closing-and-accrual/prd-salary-payout-and-erp-cash-documents.md,
// «Технические ограничения»: «предварительно 15 секунд») — операция
// синхронная, по таймауту пользователь получает ошибку без записи движения
// (Фаза 12 не создаёт BalanceTransaction, пока create() не резолвится).
const ROAPP_CASH_REQUEST_TIMEOUT_MS = 15_000;

// Реализация ErpCashDocumentPort (application/ports/erp-cash-document.port.ts)
// для направления service — RemOnline. Исследование через MCP RoApp
// (2026-08-24, см. отчёт предыдущего агента) подтвердило: POST/DELETE
// /finance/accounts/{account_id}/transactions[/{transaction_id}] покрывают
// create/delete, оба обязательных условия PRD 3 выполнены.
@Injectable()
export class RoappCashDocumentAdapter implements ErpCashDocumentPort {
    constructor(
        private readonly roapp: RoappHttpService,
        private readonly db: DatabaseService,
        @Inject(ERP_CASH_CONFIG_REPOSITORY)
        private readonly configRepo: ErpCashConfigRepositoryPort,
        @Inject(ERP_CASH_DOCUMENT_REPOSITORY)
        private readonly documentRepo: ErpCashDocumentRepositoryPort,
    ) {}

    async create(
        params: CreateErpCashDocumentParams,
    ): Promise<{ externalId: string }> {
        const cashboxId = await this.resolveCashboxId();
        await this.ensureEmployeeHasRoappIdentity(params.employeeId);

        try {
            const { data } = await this.roapp.instance.post<unknown>(
                `/finance/accounts/${cashboxId}/transactions`,
                {
                    // POST .../transactions типизирует amount как string
                    // (см. get-endpoint, 2026-08-24) без формата в описании —
                    // целые рубли из домена приводим к десятичной строке с
                    // копейками ("1500.00"), это общепринятый формат денежных
                    // сумм в REST API и не требует округления (amount уже
                    // Int, см. валидацию BalanceTransaction/ErpCashDocument).
                    amount: params.amount.toFixed(2),
                    // У RemOnline POST принимает direction: "income"|"expense"
                    // — тем же вокабуляром назван erpCashDocumentKindSchema в
                    // contracts, лишнего маппинга enum→enum не нужно.
                    direction: params.kind === 'INCOME' ? 'income' : 'expense',
                    // В RemOnline нет поля для получателя-сотрудника как
                    // агента транзакции (client_id — контрагент/клиент, не
                    // сотрудник компании, см. WHY в erp-cash-document.port.ts)
                    // — назначение и ФИО сотрудника (уже включённые
                    // вызывающей стороной, Фаза 12) идут текстом.
                    description: params.purpose,
                    custom_created_at: toRoappIsoDate(params.occurredAt),
                },
                { timeout: ROAPP_CASH_REQUEST_TIMEOUT_MS },
            );

            const transaction = FinanceTransactionSchema.parse(data);
            return { externalId: String(transaction.id) };
        } catch (error) {
            throw new BadGatewayException(
                `Не удалось создать движение в кассе RemOnline: ${toErrorMessage(error)}`,
            );
        }
    }

    async delete(document: DeleteErpCashDocumentParams): Promise<void> {
        const cashboxId = await this.resolveCashboxId();

        try {
            await this.roapp.instance.delete(
                `/finance/accounts/${cashboxId}/transactions/${document.externalId}`,
                { timeout: ROAPP_CASH_REQUEST_TIMEOUT_MS },
            );
        } catch (error) {
            throw new BadGatewayException(
                `Не удалось удалить движение ${document.externalId} в кассе RemOnline: ${toErrorMessage(error)}`,
            );
        }
    }

    // Локальный lookup, не запрос к RemOnline — см. WHY-комментарий у
    // ErpCashDocumentPort.findByKey (уникальный индекс transactionId в БД
    // уже исключает задвоение, у RemOnline нет естественного поиска по
    // нашему transactionId).
    async findByKey(
        transactionId: string,
    ): Promise<FoundErpCashDocument | null> {
        const document =
            await this.documentRepo.findByTransactionId(transactionId);
        if (!document) return null;

        return {
            externalId: document.externalId,
            kind: document.kind,
            amount: document.amount,
        };
    }

    // «Пустая конфигурация — понятная ошибка ДО обращения в ERP» (PRD 3,
    // «Критерии готовности») — читается перед любым HTTP-вызовом, в т.ч.
    // перед delete(), а не только create(): без account_id DELETE тоже не
    // на чем строить.
    private async resolveCashboxId(): Promise<number> {
        const config = await this.configRepo.findByDirection('service');
        if (!config || config.roappCashboxId === null) {
            throw new ErpCashConfigMissingException('service');
        }
        return config.roappCashboxId;
    }

    // «EmployeeIdentity сотрудника в ERP направления обязательна... Проверка
    // выполняется до обращения в ERP» (PRD 3, «Технические ограничения»).
    // Значение идентичности (RoappEmployee.id) в теле запроса RemOnline не
    // используется (см. WHY у CreateErpCashDocumentParams.employeeId в
    // erp-cash-document.port.ts) — это чистая проверка готовности, а не
    // подготовка payload'а. Читаем таблицу employeeIdentity напрямую через
    // DatabaseService, как ServiceCalculationDataRepository.findEmployeeIdentities
    // (см. domains/service/modules/accounting/infrastructure/repositories/
    // service-calculation-data.repository.ts) — EmployeeIdentityModule не
    // экспортирует ни репозиторий, ни его DI-токен наружу (см.
    // employee-identity.module.ts), только ResolveEmployeeByExternalIdService.
    private async ensureEmployeeHasRoappIdentity(
        bitrixEmployeeId: number,
    ): Promise<void> {
        const identity = await this.db.getClient().employeeIdentity.findFirst({
            where: {
                bitrixEmployeeId,
                system: 'ROAPP',
                identifierType: 'EMPLOYEE_ID',
            },
        });
        if (!identity) {
            throw new EmployeeErpIdentityMissingException(
                bitrixEmployeeId,
                'RemOnline',
            );
        }
    }
}
