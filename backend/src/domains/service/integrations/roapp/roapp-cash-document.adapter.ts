import { BadGatewayException, Inject, Injectable } from '@nestjs/common';
import axios from 'axios';
import { RoappHttpService } from './roapp.instace';
import { toRoappIsoDate } from './roapp.service';
import { FinanceTransactionSchema } from './schemas/financeTransaction.schema';
import { DatabaseService } from '@/infrustructure/database/database.service';
import { ERP_CASH_CONFIG_REPOSITORY } from '@/domains/service/modules/accounting/application/ports/erp-cash-config.port';
import type {
    ErpCashConfig,
    ErpCashConfigRepositoryPort,
} from '@/domains/service/modules/accounting/application/ports/erp-cash-config.port';
import { PAYOUT_CASHBOX_RECORD_REPOSITORY } from '@/domains/service/modules/accounting/application/ports/payout-cashbox-record-repository.port';
import type { PayoutCashboxRecordRepositoryPort } from '@/domains/service/modules/accounting/application/ports/payout-cashbox-record-repository.port';
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

// error.message из axios отдаёт только "Request failed with status code
// 400" без причины — тело ответа RemOnline (обычно там и есть конкретное
// поле/правило, которое не устроило ERP) подмешиваем в само сообщение
// исключения, чтобы оно долетало до фронта (BadGatewayException →
// DomainExceptionFilter → ERP-error alert) без обращения к серверным логам.
function describeError(error: unknown): string {
    if (axios.isAxiosError(error)) {
        const data = error.response?.data as unknown;
        const detail =
            data === undefined
                ? undefined
                : typeof data === 'string'
                  ? data
                  : JSON.stringify(data);
        return detail ? `${error.message} — ${detail}` : error.message;
    }
    return error instanceof Error ? error.message : String(error);
}

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
        @Inject(PAYOUT_CASHBOX_RECORD_REPOSITORY)
        private readonly documentRepo: PayoutCashboxRecordRepositoryPort,
    ) {}

    async create(
        params: CreateErpCashDocumentParams,
    ): Promise<{ externalId: string }> {
        const config = await this.resolveConfig();
        if (config.roappCashboxId === null || config.roappCategoryId === null) {
            throw new ErpCashConfigMissingException('service');
        }
        const cashboxId = config.roappCashboxId;
        const categoryId = config.roappCategoryId;
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
                    // Int, см. валидацию BalanceTransaction/Cashbox).
                    amount: params.amount.toFixed(2),
                    // У RemOnline POST принимает direction: "income"|"expense"
                    // — тем же вокабуляром назван erpCashDocumentKindSchema в
                    // contracts, лишнего маппинга enum→enum не нужно.
                    direction: params.kind === 'INCOME' ? 'income' : 'expense',
                    // Cashflow Category ID — без него RemOnline отклоняет
                    // запрос 400 (обнаружено 2026-08-25 на реальном стенде),
                    // хотя схема эндпоинта формально не помечает category_id
                    // обязательным.
                    category_id: categoryId,
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
                `Не удалось создать движение в кассе RemOnline: ${describeError(error)}`,
            );
        }
    }

    async delete(document: DeleteErpCashDocumentParams): Promise<void> {
        const config = await this.resolveConfig();
        if (config.roappCashboxId === null) {
            throw new ErpCashConfigMissingException('service');
        }
        const cashboxId = config.roappCashboxId;

        try {
            await this.roapp.instance.delete(
                `/finance/accounts/${cashboxId}/transactions/${document.externalId}`,
                { timeout: ROAPP_CASH_REQUEST_TIMEOUT_MS },
            );
        } catch (error) {
            throw new BadGatewayException(
                `Не удалось удалить движение ${document.externalId} в кассе RemOnline: ${describeError(error)}`,
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
    // перед delete(), а не только create(). Один запрос к порту на вызов —
    // create()/delete() сами решают, какие поля им обязательны
    // (delete() не требует roappCategoryId: DELETE .../transactions/{id} не
    // принимает category_id, у существующего движения она уже задана в
    // RemOnline).
    private async resolveConfig(): Promise<ErpCashConfig> {
        const config = await this.configRepo.findByDirection('service');
        if (!config) {
            throw new ErpCashConfigMissingException('service');
        }
        return config;
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
