import { BadGatewayException, Inject, Injectable } from '@nestjs/common';
import axios from 'axios';
import { promises as fs } from 'fs';
import { join } from 'path';
import { SHOP_ERP_CASH_CONFIG_REPOSITORY } from '@/domains/shop/modules/accounting/application/ports/shop-erp-cash-config.port';
import type { ShopErpCashConfigRepositoryPort } from '@/domains/shop/modules/accounting/application/ports/shop-erp-cash-config.port';
import { SHOP_ERP_CASH_DOCUMENT_REPOSITORY } from '@/domains/shop/modules/accounting/application/ports/shop-erp-cash-document-repository.port';
import type { ShopErpCashDocumentRepositoryPort } from '@/domains/shop/modules/accounting/application/ports/shop-erp-cash-document-repository.port';
import { EMPLOYEE_IDENTITY_REPOSITORY } from '@/modules/employee-identity/application/ports/employee-identity.port';
import type { EmployeeIdentityRepositoryPort } from '@/modules/employee-identity/application/ports/employee-identity.port';
import type {
    CreateErpCashDocumentParams,
    DeleteErpCashDocumentParams,
    ErpCashDocumentPort,
    FoundErpCashDocument,
} from '@/domains/shop/modules/accounting/application/ports/erp-cash-document.port';
import {
    ShopEmployeeMoySkladIdentityMissingException,
    ShopErpCashConfigIncompleteException,
} from '@/domains/shop/modules/accounting/domain/exceptions/erp-cash-document.exception';
import { MoyskladHttpService } from './moysklad.instance';

// Кассовые документы МойСклада (PRD 3
// docs/payroll-closing-and-accrual/prd-salary-payout-and-erp-cash-documents.md,
// Фаза 11) — реализация SHOP_ERP_CASH_DOCUMENT_PORT. Расход — POST/DELETE
// /entity/cashout, приход — POST/DELETE /entity/cashin (подтверждено
// get_endpoint_info через MCP moysklad, 2026-08-24).
//
// ============================ agent: Employee vs Counterparty ============================
// get_schema_fields('CashOut'/'CashIn') (2026-08-24) описывает поле agent
// дословно как «Метаданные контрагента или юрлица» — ни один из вариантов не
// назван «сотрудник». get_schema_fields('Employee') подтверждает, что
// Employee — самостоятельная сущность API без пересечения полей со
// схемой Counterparty (нет полей вроде "тип контрагента", ИНН организации и
// т.п., которые обычно фигурируют в agent-подобных ссылках). Иными словами,
// формально agent, скорее всего, обязан ссылаться на Counterparty, а не на
// Employee напрямую — но живого запроса на реальный стенд в рамках этой
// фазы делать нельзя (см. ограничение безопасности PRD/Фазы 11), а блокировать
// реализацию порта заглушкой было бы хуже, чем best-effort попытка.
//
// Решение: adapter строит agent как meta-ссылку на Employee МойСклада
// (резолв через EmployeeIdentity(MOY_SKLAD, EMPLOYEE_ID) — единственная
// связь с сотрудником, которая у нас вообще есть). Если МойСклад в реальности
// отклонит meta.type="employee" в agent, потребуется завести отдельную
// настройку «сотрудник → контрагент для кассовых ордеров» (или создавать
// контрагента на сотрудника автоматически) — TODO для Фазы 12, ПЕРЕД первым
// реальным запуском на проде это поведение нужно проверить вручную на
// стенде (см. ограничение безопасности исследования Фазы 11 — здесь этого
// сделать было нельзя).
//
// ============================ sum: рубли -> копейки ============================
// get_schema_fields('CashOut'/'CashIn') не проговаривает единицу измерения
// sum явно (документация МойСклад не даёт этого через доступные MCP-
// инструменты), но во ВСЕХ остальных денежных полях REST API МойСклад
// (Product.salePrices, Demand.sum и т.п.) используется наименьшая единица
// валюты — копейки; sum кассовых ордеров по общему соглашению API следует
// той же конвенции. toKopecks() ниже — единственное место конвертации,
// ПЕРЕПРОВЕРИТЬ пробным запросом на стенде перед первым реальным вызовом
// create() в проде (см. TODO выше).
//
// ============================ moySkladIncomeItemId ============================
// CashIn НЕ отправляет ничего похожего на статью доходов — get_schema_fields
// подтверждает, что такого поля в схеме CashIn нет вообще (см. WHY у
// erpCashConfigSchema в contracts/commands/erp-cash.ts). create() для
// kind: 'INCOME' поэтому НЕ читает ShopErpCashConfig.moySkladIncomeItemId.

// Мутирующие операции (create/delete) — не постраничное чтение, где долгий
// ответ можно просто повторить со следующим тиком крона: зависший запрос
// на создание/удаление реального денежного документа должен явно упасть,
// а не висеть неограниченно.
const REQUEST_TIMEOUT_MS = 15_000;

const MOYSKLAD_BASE_URL = 'https://api.moysklad.ru/api/remap/1.2';

type MoyskladMetaRef = {
    meta: { href: string; type: string; mediaType: 'application/json' };
};

// МойСклад принимает ссылки на другие сущности как meta-объект с href вида
// {baseUrl}/entity/{type}/{id} (тот же формат, что и в ответах API, откуда
// его достаёт extractIdFromHref в sync/moySklad — здесь обратная операция:
// id уже есть, строим ссылку для запроса).
function metaRef(type: string, id: string): MoyskladMetaRef {
    return {
        meta: {
            href: `${MOYSKLAD_BASE_URL}/entity/${type}/${id}`,
            type,
            mediaType: 'application/json',
        },
    };
}

@Injectable()
export class MoyskladCashDocumentAdapter implements ErpCashDocumentPort {
    constructor(
        private readonly moysklad: MoyskladHttpService,
        @Inject(SHOP_ERP_CASH_CONFIG_REPOSITORY)
        private readonly configRepo: ShopErpCashConfigRepositoryPort,
        @Inject(SHOP_ERP_CASH_DOCUMENT_REPOSITORY)
        private readonly documentRepo: ShopErpCashDocumentRepositoryPort,
        @Inject(EMPLOYEE_IDENTITY_REPOSITORY)
        private readonly employeeIdentityRepo: EmployeeIdentityRepositoryPort,
    ) {}

    async create(
        params: CreateErpCashDocumentParams,
    ): Promise<{ externalId: string }> {
        const config = await this.configRepo.findConfig();
        if (!config?.organizationId) {
            throw new ShopErpCashConfigIncompleteException(
                'юрлицо (organizationId)',
            );
        }
        const expenseItemId = config.moySkladExpenseItemId;
        if (params.kind === 'OUTCOME' && !expenseItemId) {
            throw new ShopErpCashConfigIncompleteException(
                'статья расходов (moySkladExpenseItemId)',
            );
        }

        const identities = await this.employeeIdentityRepo.findByEmployee(
            params.employeeId,
        );
        const moySkladIdentity = identities.find(
            (identity) =>
                identity.system === 'MOY_SKLAD' &&
                identity.identifierType === 'EMPLOYEE_ID',
        );
        if (!moySkladIdentity) {
            throw new ShopEmployeeMoySkladIdentityMissingException(
                params.employeeId,
            );
        }

        const body: Record<string, unknown> = {
            organization: metaRef('organization', config.organizationId),
            // См. WHY-блок "agent: Employee vs Counterparty" выше.
            agent: metaRef('employee', moySkladIdentity.externalId),
            sum: this.toKopecks(params.amount),
            description: params.purpose,
            moment: this.formatMoment(params.occurredAt),
            // Ключ идемпотентности на стороне МойСклада (доп. защита поверх
            // уникального индекса transactionId в локальной БД, см.
            // ShopErpCashDocumentRepositoryPort) — позиция для ручной
            // сверки, если когда-нибудь понадобится сопоставить документы
            // напрямую в МойСкладе.
            externalCode: params.transactionId,
        };
        if (params.kind === 'OUTCOME' && expenseItemId) {
            body.expenseItem = metaRef('expenseitem', expenseItemId);
        }
        // CashIn: намеренно не добавляем аналог статьи доходов — см. WHY-блок
        // "moySkladIncomeItemId" выше.

        const endpoint =
            params.kind === 'OUTCOME' ? '/entity/cashout' : '/entity/cashin';
        try {
            const { data } = await this.moysklad.instance.post<{
                id: string;
            }>(endpoint, body, { timeout: REQUEST_TIMEOUT_MS });
            return { externalId: data.id };
        } catch (error) {
            await this.dumpError(error);
            throw new BadGatewayException(
                `Не удалось создать кассовый документ МойСклад (${endpoint}): ` +
                    `${error instanceof Error ? error.message : String(error)}`,
            );
        }
    }

    async delete(document: DeleteErpCashDocumentParams): Promise<void> {
        const endpoint =
            document.kind === 'OUTCOME'
                ? `/entity/cashout/${document.externalId}`
                : `/entity/cashin/${document.externalId}`;
        try {
            await this.moysklad.instance.delete(endpoint, {
                timeout: REQUEST_TIMEOUT_MS,
            });
        } catch (error) {
            await this.dumpError(error);
            throw new BadGatewayException(
                `Не удалось удалить кассовый документ МойСклад (${endpoint}): ` +
                    `${error instanceof Error ? error.message : String(error)}`,
            );
        }
    }

    // Локальный lookup, не запрос к МойСкладу — см. WHY на
    // ErpCashDocumentPort.findByKey (application/ports/erp-cash-document.port.ts).
    async findByKey(
        transactionId: string,
    ): Promise<FoundErpCashDocument | null> {
        const record =
            await this.documentRepo.findByTransactionId(transactionId);
        if (!record) return null;
        return {
            externalId: record.externalId,
            kind: record.kind,
            amount: record.amount,
        };
    }

    // См. WHY-блок "sum: рубли -> копейки" в комментарии над классом.
    private toKopecks(rubles: number): number {
        return Math.round(rubles * 100);
    }

    // МойСклад ожидает даты в формате "YYYY-MM-DD HH:mm:ss" — тот же формат,
    // что использует MoyskladService.formatMoyskladDateTime (moysklad.service.ts)
    // для фильтров чтения; дублируем здесь, а не переиспользуем приватный
    // метод сервиса, чтобы кассовый адаптер не тянул зависимость на
    // MoyskladService целиком (generic-методы постраничного чтения ему не
    // нужны).
    private formatMoment(date: Date): string {
        const pad = (n: number) => String(n).padStart(2, '0');
        return (
            `${date.getUTCFullYear()}-${pad(date.getUTCMonth() + 1)}-${pad(date.getUTCDate())}` +
            ` ${pad(date.getUTCHours())}:${pad(date.getUTCMinutes())}:${pad(date.getUTCSeconds())}`
        );
    }

    // Тот же приём, что MoyskladService.dumpError — AxiosError.toJSON()
    // стирает error.response до того, как доходит до нашего replacer, а
    // status/data реального ответа ERP — самое полезное для диагностики
    // отказа создания/удаления денежного документа.
    private async dumpError(error: unknown): Promise<void> {
        const dumpTarget = axios.isAxiosError(error)
            ? {
                  ...error,
                  response: error.response && {
                      status: error.response.status,
                      statusText: error.response.statusText,
                      data: error.response.data as unknown,
                  },
              }
            : error;
        const seen = new WeakSet<object>();
        const serialized = JSON.stringify(
            dumpTarget,
            (_key, value: unknown) => {
                if (value instanceof Error) {
                    const plain: Record<string, unknown> = {
                        name: value.name,
                        message: value.message,
                        stack: value.stack,
                    };
                    for (const key of Object.keys(value)) {
                        plain[key] = (
                            value as unknown as Record<string, unknown>
                        )[key];
                    }
                    return plain;
                }
                if (typeof value === 'object' && value !== null) {
                    if (seen.has(value)) return '[Circular]';
                    seen.add(value);
                }
                return value;
            },
            2,
        );
        await fs.writeFile(
            join(__dirname, 'cash-document-error.json'),
            serialized,
        );
    }
}
