import { BadGatewayException, Injectable } from '@nestjs/common';
import { z } from 'zod';
import { RoappHttpService } from './roapp.instace';
import { EmployeesShortSchema } from './schemas/employees.schema';
import { OrderTypesSchema } from './schemas/orderTypes.schema';
import { MarketingSourcesShortSchema } from './schemas/marketingSources.schema';
import { OrderStatusesSchema } from './schemas/orderStatuses.schema';
import { OrderSchema } from './schemas/orders.schema';
import { OrderItemSchema } from './schemas/orderItems.schema';
import { ServiceSchema } from './schemas/services.schema';
import { ProductSchema } from './schemas/products.schema';
import { CategorySchema } from './schemas/serviceCatalog.schema';
import { delay } from '../../../../shared/delay';
import {
    Params,
    RoappDataEnvelope,
    RoappPaginatedResponse,
} from './roapp.types';

// Экспортированы — переиспользуются RoappCashDocumentAdapter
// (../roapp-cash-document.adapter.ts, PRD 3 Фаза 11), которому нужен тот же
// формат ошибки и той же ISO-даты без миллисекунд для custom_created_at, не
// только для заказов.
export function toErrorMessage(error: unknown): string {
    return error instanceof Error ? error.message : String(error);
}

// Roapp принимает ISO-дату без миллисекунд: %Y-%m-%dT%H:%M:%SZ
export function toRoappIsoDate(date: Date): string {
    return date.toISOString().replace(/\.\d{3}Z$/, 'Z');
}

@Injectable()
export class RoappService {
    constructor(private roApp: RoappHttpService) {}

    async *fetchCreatedOrders(fromDate: Date | undefined) {
        yield* this._fetchOrders(fromDate, 'created');
    }

    async *fetchUpdatedOrders(fromDate: Date | undefined) {
        yield* this._fetchOrders(fromDate, 'updated');
    }

    // Заказы, закрытые в диапазоне [from, to] — вход синка по требованию
    // из закрытия расчётного периода (PRD 1 docs/payroll-closing-and-accrual):
    // расчёт зарплаты считает по RoappOrder.closedAt, поэтому дотягиваем
    // ровно те заказы, которые попадают в месяц, а не всё, что менялось.
    async *fetchOrdersClosedBetween(from: Date, to: Date) {
        yield* this._fetchOrdersByParams({
            page: 1,
            closed_at: [toRoappIsoDate(from), toRoappIsoDate(to)],
        });
    }

    async *_fetchOrders(
        fromDate: Date | undefined,
        createdOrUpdated: 'created' | 'updated',
    ) {
        const params: Params = {
            page: 1,
            [createdOrUpdated === 'created' ? 'created_at' : 'modified_at']:
                fromDate ? toRoappIsoDate(fromDate) : undefined,
        };
        yield* this._fetchOrdersByParams(params);
    }

    private async *_fetchOrdersByParams(params: Params) {
        while (true) {
            try {
                const {
                    data: { data: deals, paging },
                } = await this.roApp.instance.get<RoappPaginatedResponse>(
                    `/orders`,
                    { params },
                );

                yield deals.map((deal) => OrderSchema.parse(deal));

                const { page, total_pages } = paging;
                if (page === total_pages) break;

                params.page++;
                await delay(500);
            } catch (error) {
                console.log(error);
                throw new BadGatewayException(
                    `Failed to fetch sources from Roapp: ${toErrorMessage(error)}`,
                );
            }
        }
    }

    async fetchOrderItems(
        orderId: number,
    ): Promise<z.infer<typeof OrderItemSchema>[]> {
        try {
            const { data: items } = await this.roApp.instance.get<unknown[]>(
                `/orders/${orderId}/items`,
            );
            return items.map((item) => OrderItemSchema.parse(item));
        } catch (error) {
            throw new BadGatewayException(
                `Failed to fetch sources from Roapp: ${toErrorMessage(error)}`,
            );
        }
    }

    async *fetchServices() {
        let requestPage = 1;

        while (true) {
            try {
                const {
                    data: { data: services, paging },
                } = await this.roApp.instance.get<RoappPaginatedResponse>(
                    '/catalog/services',
                    { params: { page: requestPage } },
                );

                yield services.map((service) => ServiceSchema.parse(service));

                const { page, total_pages } = paging;
                if (page === total_pages) break;

                requestPage++;
                await delay(500);
            } catch (error) {
                throw new BadGatewayException(
                    `Failed to fetch sources from Roapp: ${toErrorMessage(error)}`,
                );
            }
        }
    }

    async *fetchProducts() {
        let requestPage = 1;

        while (true) {
            try {
                const {
                    data: { data: services, paging },
                } = await this.roApp.instance.get<RoappPaginatedResponse>(
                    '/catalog/products',
                    { params: { page: requestPage } },
                );

                yield services.map((service) => ProductSchema.parse(service));

                const { page, total_pages } = paging;
                if (page === total_pages) break;

                requestPage++;
                await delay(500);
            } catch (error) {
                throw new BadGatewayException(
                    `Failed to fetch sources from Roapp: ${toErrorMessage(error)}`,
                );
            }
        }
    }

    async *fetchServicesCategories() {
        yield* this._fetchCategories('/catalog/services/categories');
    }

    async *fetchProductsCategories() {
        yield* this._fetchCategories('/catalog/products/categories');
    }

    async fetchAllServiceCategories(): Promise<
        { id: number; name: string; parentId: number | null }[]
    > {
        const categories: z.infer<typeof CategorySchema>[] = [];
        for await (const batch of this.fetchServicesCategories()) {
            categories.push(...batch);
        }
        return categories.map((c) => ({
            id: c.id,
            name: c.title,
            parentId: c.parent_id,
        }));
    }

    async *_fetchCategories(url: string) {
        let requestPage = 1;

        while (true) {
            try {
                const {
                    data: { data: serviceCatalog, paging },
                } = await this.roApp.instance.get<RoappPaginatedResponse>(url, {
                    params: { page: requestPage },
                });

                yield serviceCatalog.map((item) => CategorySchema.parse(item));

                const { page, total_pages } = paging;
                if (page === total_pages) break;

                requestPage++;
                await delay(500);
            } catch (error) {
                throw new BadGatewayException(
                    `Failed to fetch sources from Roapp: ${toErrorMessage(error)}`,
                );
            }
        }
    }

    async fetchEmployees(): Promise<z.infer<typeof EmployeesShortSchema>[]> {
        try {
            const {
                data: { data: employees },
            } =
                await this.roApp.instance.get<RoappDataEnvelope>(
                    '/company/employees',
                );
            return employees.map((employee) =>
                EmployeesShortSchema.parse(employee),
            );
        } catch (error) {
            throw new BadGatewayException(
                `Failed to fetch sources from Roapp: ${toErrorMessage(error)}`,
            );
        }
    }

    async fetchOrderTypes(): Promise<z.infer<typeof OrderTypesSchema>[]> {
        try {
            const { data: orderTypes } =
                await this.roApp.instance.get<unknown[]>('/orders/types');
            return orderTypes.map((orderType) =>
                OrderTypesSchema.parse(orderType),
            );
        } catch (error) {
            throw new BadGatewayException(
                `Failed to fetch orderTypes from Roapp: ${toErrorMessage(error)}`,
            );
        }
    }

    async fetchOrderStatuses(): Promise<z.infer<typeof OrderStatusesSchema>[]> {
        try {
            const { data: orderTypes } =
                await this.roApp.instance.get<unknown[]>('/orders/statuses');
            return orderTypes.map((orderType) =>
                OrderStatusesSchema.parse(orderType),
            );
        } catch (error) {
            throw new BadGatewayException(
                `Failed to fetch sources from Roapp: ${toErrorMessage(error)}`,
            );
        }
    }

    async fetchMarketingSources(): Promise<
        z.infer<typeof MarketingSourcesShortSchema>[]
    > {
        try {
            const res = await fetch(
                'https://api.roapp.io/marketing/campaigns/',
                {
                    headers: {
                        Authorization: `Bearer ${process.env.ROAPP_TOKEN}`,
                    },
                },
            );
            const { data: marketingSources } =
                (await res.json()) as RoappDataEnvelope;
            return marketingSources.map((marketingSource) =>
                MarketingSourcesShortSchema.parse(marketingSource),
            );
        } catch (error) {
            throw new BadGatewayException(
                `Failed to fetch sources from Roapp: ${toErrorMessage(error)}`,
            );
        }
    }
}
