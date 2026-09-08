import { BadGatewayException, Injectable, Logger } from '@nestjs/common';
import axios from 'axios';
import { z } from 'zod';
import { promises as fs } from 'fs';
import { join } from 'path';
import { MoyskladHttpService } from './moysklad.instance';
import { MoyskladListParams, MoyskladListResponse } from './moysklad.types';
import { CustomerOrderSchema } from './schemas/customerOrders.schema';
import { ProductSchema } from './schemas/products.schema';
import { ServiceSchema } from './schemas/services.schema';
import { EmployeeSchema } from './schemas/employees.schema';
import { CounterpartySchema } from './schemas/counterparties.schema';
import { DemandSchema } from './schemas/demands.schema';
import { ProductFolderSchema } from './schemas/productFolders.schema';
import { StoreSchema } from './schemas/stores.schema';
import {
    StockByStoreRow,
    StockByStoreRowSchema,
} from './schemas/stock-report.schema';
import {
    AssortmentStockRow,
    toAssortmentStockRow,
} from './schemas/assortment-stock.schema';
import { delay } from '../../../../shared/delay';

const PAGE_LIMIT = 1000;

// Опрос асинхронной задачи "Остатки по складам" (shop-turnover-report D5) —
// контракт не подтверждён до конца документацией, доступной через
// использованный инструмент (см. design.md "Открытые вопросы"), поэтому
// интервал/число попыток — разумная оценка ("не реже раза в час" из D5 не
// требует быстрого ответа, это фоновый почасовой крон, а не HTTP-запрос
// пользователя). При любой проблеме с опросом fetchStockByStore()
// переключается на синхронный постраничный fallback (см. design.md Risks).
const STOCK_REPORT_ASYNC_POLL_INTERVAL_MS = 3000;
const STOCK_REPORT_ASYNC_POLL_MAX_ATTEMPTS = 20;

// Общие параметры выборки отгрузок (см. комментарий в _fetchDemands про
// expand) — одни и те же для инкрементального синка крона и синка месяца.
const DEMAND_EXPAND_PARAMS: Record<string, string> = {
    expand: 'positions,positions.assortment',
    fields: 'stock',
};

@Injectable()
export class MoyskladService {
    private readonly logger = new Logger(MoyskladService.name);

    constructor(private moysklad: MoyskladHttpService) {}

    private async dumpError(error: unknown): Promise<void> {
        // AxiosError.toJSON() runs before our replacer and strips `response`
        // (status/data from the actual server reply), so it must be captured separately.
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
        await fs.writeFile(join(__dirname, 'error.json'), serialized);
    }

    async *fetchCustomerOrders(updatedFrom?: Date) {
        yield* this._fetchPaged(
            '/entity/customerorder',
            CustomerOrderSchema,
            updatedFrom,
        );
    }

    async *fetchProducts() {
        yield* this._fetchPaged('/entity/product', ProductSchema);
    }

    async *fetchProductFolders() {
        yield* this._fetchPaged('/entity/productfolder', ProductFolderSchema);
    }

    async *fetchServices() {
        yield* this._fetchPaged('/entity/service', ServiceSchema);
    }

    // Справочник складов (D2 shop-turnover-report) — обычная постраничная
    // выгрузка, как productFolders/services, без async-режима отчётов.
    async *fetchStores() {
        yield* this._fetchPaged('/entity/store', StoreSchema);
    }

    // Почасовой снимок остатков (D5 shop-turnover-report):
    // GET /report/stock/bystore?async=true&groupBy=product — весь каталог
    // одной асинхронной задачей (без limit/offset, см. design.md Context —
    // с async=true пагинация запрещена самим API, ошибка 61001). Контракт
    // опроса задачи не подтверждён до конца документацией — см.
    // _pollStockByStoreTask. Любая проблема с async-режимом (запуск,
    // опрос, таймаут) переключает метод на синхронную постраничную
    // выгрузку того же отчёта (design.md Risks).
    async *fetchStockByStore(): AsyncGenerator<StockByStoreRow[]> {
        try {
            const rows = await this._fetchStockByStoreAsync();
            yield rows;
            return;
        } catch (error) {
            this.logger.warn(
                `Async-отчёт МойСклад "Остатки по складам" недоступен (${
                    error instanceof Error ? error.message : String(error)
                }), переключаемся на синхронную постраничную выгрузку`,
            );
        }

        yield* this._fetchPaged(
            '/report/stock/bystore',
            StockByStoreRowSchema,
            undefined,
            { groupBy: 'product' },
        );
    }

    private async _fetchStockByStoreAsync(): Promise<StockByStoreRow[]> {
        const { data } = await this.moysklad.instance.get<{
            rows?: unknown[];
            meta?: { href?: string; state?: string };
        }>('/report/stock/bystore', {
            params: { async: true, groupBy: 'product' },
        });

        const rows = await this._pollStockByStoreTask(data);
        return rows.map((row) => StockByStoreRowSchema.parse(row));
    }

    // Наиболее вероятный контракт JSON API МойСклад для async-задач (не
    // подтверждён до конца документацией, доступной через использованный
    // инструмент — см. design.md "Открытые вопросы"): если ответ на запуск
    // уже содержит `rows` — задача выполнилась синхронно (маленький
    // каталог); иначе ответ — дескриптор задачи с `meta.href`, которую
    // опрашиваем той же ссылкой, пока не появятся `rows` или задача не
    // завершится ошибкой/таймаутом. Любая ошибка здесь ловится вызывающим
    // fetchStockByStore() и переключает его на синхронный fallback.
    private async _pollStockByStoreTask(initial: {
        rows?: unknown[];
        meta?: { href?: string; state?: string };
    }): Promise<unknown[]> {
        if (Array.isArray(initial.rows)) return initial.rows;

        const initialState = initial.meta?.state;
        if (
            typeof initialState === 'string' &&
            /error|fail|ошиб/i.test(initialState)
        ) {
            throw new Error(
                `MoySklad async stock report task failed immediately, state=${initialState}`,
            );
        }

        const taskHref = initial.meta?.href;
        if (!taskHref) {
            throw new Error(
                'MoySklad async stock report: response has neither rows nor a task href',
            );
        }

        for (
            let attempt = 0;
            attempt < STOCK_REPORT_ASYNC_POLL_MAX_ATTEMPTS;
            attempt++
        ) {
            await delay(STOCK_REPORT_ASYNC_POLL_INTERVAL_MS);
            const { data } = await this.moysklad.instance.get<{
                rows?: unknown[];
                meta?: { state?: string };
            }>(taskHref);

            if (Array.isArray(data.rows)) return data.rows;

            const state = data.meta?.state;
            if (typeof state === 'string' && /error|fail|ошиб/i.test(state)) {
                throw new Error(
                    `MoySklad async stock report task failed, state=${state}`,
                );
            }
        }

        throw new Error(
            `MoySklad async stock report: polling timed out after ${STOCK_REPORT_ASYNC_POLL_MAX_ATTEMPTS} attempts`,
        );
    }

    // Бэкфилл истории остатков за прошлые периоды (D5.1
    // shop-turnover-report) — легаси GET /entity/assortment с фильтром
    // stockMoment/stockStore: остаток/себестоимость на произвольный момент
    // в прошлом для конкретного склада. Помечен к выводу из эксплуатации в
    // 2027 году (design.md Risks) — используется только для разового
    // бэкфилла, не как постоянная зависимость. Имена полей остатка/
    // себестоимости в ответе не подтверждены до конца документацией — см.
    // toAssortmentStockRow (единая точка сопоставления, легко поправить).
    async *fetchAssortmentStockAt(
        momentEnd: Date,
        storeId: string,
    ): AsyncGenerator<AssortmentStockRow[]> {
        const storeHref = `${this.moysklad.instance.defaults.baseURL}/entity/store/${storeId}`;
        const filter = `stockMoment=${this.formatMoyskladDateTime(momentEnd)};stockStore=${storeHref}`;

        let offset = 0;
        while (true) {
            try {
                const {
                    data: { rows, meta },
                } = await this.moysklad.instance.get<MoyskladListResponse>(
                    '/entity/assortment',
                    {
                        params: {
                            limit: PAGE_LIMIT,
                            offset,
                            filter,
                            groupBy: 'product',
                        },
                    },
                );

                yield rows.map((row) =>
                    toAssortmentStockRow(row, (message) =>
                        this.logger.warn(message),
                    ),
                );

                const fetched = offset + rows.length;
                if (fetched >= meta.size) break;

                offset = fetched;
                await delay(500);
            } catch (error) {
                await this.dumpError(error);
                throw new BadGatewayException(
                    `Failed to fetch assortment stock from MoySklad: ${error instanceof Error ? error.message : String(error)}`,
                );
            }
        }
    }

    async fetchEmployees(): Promise<z.infer<typeof EmployeeSchema>[]> {
        try {
            const {
                data: { rows },
            } = await this.moysklad.instance.get<MoyskladListResponse>(
                '/entity/employee',
                {
                    params: {
                        limit: PAGE_LIMIT,
                    } satisfies Partial<MoyskladListParams>,
                },
            );
            return rows.map((e) => EmployeeSchema.parse(e));
        } catch (error) {
            await this.dumpError(error);
            throw new BadGatewayException(
                `Failed to fetch employees from MoySklad: ${error instanceof Error ? error.message : String(error)}`,
            );
        }
    }

    async *fetchCounterparties(updatedFrom?: Date) {
        yield* this._fetchPaged(
            '/entity/counterparty',
            CounterpartySchema,
            updatedFrom,
        );
    }

    async *fetchCreatedDemands(fromDate?: Date) {
        yield* this._fetchDemands(fromDate, 'created');
    }

    async *fetchUpdatedDemands(fromDate?: Date) {
        yield* this._fetchDemands(fromDate, 'updated');
    }

    // Отгрузки с датой документа (moment) в [from, to] — вход синка по
    // требованию из закрытия расчётного периода (PRD 1
    // docs/payroll-closing-and-accrual): расчёт зарплаты магазина считает
    // по MoySkladDemand.moment, поэтому дотягиваем ровно отгрузки месяца.
    async *fetchDemandsByMoment(from: Date, to: Date) {
        yield* this._fetchPaged(
            '/entity/demand',
            DemandSchema,
            undefined,
            {
                ...DEMAND_EXPAND_PARAMS,
                filter:
                    `moment>=${this.formatMoyskladDateTime(from)};` +
                    `moment<=${this.formatMoyskladDateTime(to)}`,
            },
            100,
        );
    }

    private async *_fetchDemands(
        fromDate: Date | undefined,
        fromField: 'created' | 'updated',
    ) {
        // `expand` разворачивает ССЫЛКИ (positions.assortment — иначе пришёл
        // бы голый meta.href без name/type). Кастомные атрибуты (шапки
        // отгрузки и, с Фазы 10, каждой позиции — закупщики БУ техники) —
        // это embedded-значения, а не ссылки, МойСклад отдаёт их без
        // expand: `demand.attributes` (ONLINE_MANAGER_ATTR_ID) уже работает
        // без `expand=attributes` в этом же запросе — по аналогии
        // ожидаем, что `positions[].attributes` придёт так же.
        const extraParams: Record<string, string> = { ...DEMAND_EXPAND_PARAMS };
        if (fromDate) {
            extraParams.filter = `${fromField}>=${this.formatMoyskladDateTime(fromDate)}`;
        }

        yield* this._fetchPaged(
            '/entity/demand',
            DemandSchema,
            undefined,
            extraParams,
            100,
        );
    }

    async *fetchAssortment(
        filter?: string,
    ): AsyncGenerator<{ id: string; name: string }[]> {
        let offset = 0;

        while (true) {
            try {
                const params: Record<string, unknown> = {
                    limit: PAGE_LIMIT,
                    offset,
                };
                if (filter) params.filter = filter;

                const {
                    data: { rows, meta },
                } = await this.moysklad.instance.get<MoyskladListResponse>(
                    '/entity/assortment',
                    { params },
                );

                yield (rows as { id: string; name: string }[]).map(
                    ({ id, name }) => ({
                        id,
                        name,
                    }),
                );

                const fetched = offset + rows.length;
                if (fetched >= meta.size) break;

                offset = fetched;
                await delay(500);
            } catch (error) {
                await this.dumpError(error);
                throw new BadGatewayException(
                    `Failed to fetch assortment from MoySklad: ${error instanceof Error ? error.message : String(error)}`,
                );
            }
        }
    }

    async batchUpdateProducts(updates: object[]): Promise<void> {
        const CHUNK = 1000;
        try {
            for (let i = 0; i < updates.length; i += CHUNK) {
                await this.moysklad.instance.post(
                    '/entity/product',
                    updates.slice(i, i + CHUNK),
                );
                if (i + CHUNK < updates.length) await delay(300);
            }
        } catch (error) {
            await this.dumpError(error);
            throw new BadGatewayException(
                `Failed to batch update products in MoySklad: ${error instanceof Error ? error.message : String(error)}`,
            );
        }
    }

    // МойСклад ожидает даты в формате "YYYY-MM-DD HH:mm:ss", а не ISO 8601
    private formatMoyskladDateTime(date: Date): string {
        const pad = (n: number) => String(n).padStart(2, '0');
        return (
            `${date.getUTCFullYear()}-${pad(date.getUTCMonth() + 1)}-${pad(date.getUTCDate())}` +
            ` ${pad(date.getUTCHours())}:${pad(date.getUTCMinutes())}:${pad(date.getUTCSeconds())}`
        );
    }

    private async *_fetchPaged<T extends z.ZodTypeAny>(
        url: string,
        schema: T,
        updatedFrom?: Date,
        extraParams?: Record<string, string>,
        pageSize: number = PAGE_LIMIT,
    ): AsyncGenerator<z.output<T>[]> {
        let offset = 0;

        const baseParams: Partial<MoyskladListParams> &
            Record<string, unknown> = {
            limit: pageSize,
            ...(updatedFrom && {
                updatedFrom: this.formatMoyskladDateTime(updatedFrom),
            }),
            ...extraParams,
        };

        while (true) {
            try {
                const {
                    data: { rows, meta },
                } = await this.moysklad.instance.get<MoyskladListResponse>(
                    url,
                    { params: { ...baseParams, offset } },
                );

                yield rows.map((row) => schema.parse(row));

                const fetched = offset + rows.length;
                if (fetched >= meta.size) break;

                offset = fetched;
                await delay(400);
            } catch (error) {
                await this.dumpError(error);
                throw new BadGatewayException(
                    `Failed to fetch ${url} from MoySklad: ${error instanceof Error ? error.message : String(error)}`,
                );
            }
        }
    }
}
