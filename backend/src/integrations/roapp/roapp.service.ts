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
import { delay } from '../../utils/delay';
import { Params } from './roapp.types';

@Injectable()
export class RoappService {
  constructor(private roApp: RoappHttpService) {}

  async *fetchCreatedOrders(
    fromDate: Date | undefined,
    createdOrUpdated: 'created' | 'updated',
  ) {
    yield* this._fetchOrders(fromDate, 'created');
  }

  async *fetchUpdatedOrders(
    fromDate: Date | undefined,
    createdOrUpdated: 'created' | 'updated',
  ) {
    yield* this._fetchOrders(fromDate, 'updated');
  }

  async *_fetchOrders(
    fromDate: Date | undefined,
    createdOrUpdated: 'created' | 'updated',
  ) {
    // Roapp принимает ISO-дату без миллисекунд: %Y-%m-%dT%H:%M:%SZ
    const isoDateWithoutMs = fromDate?.toISOString().replace(/\.\d{3}Z$/, 'Z');

    const params: Params = {
      requestPage: 1,
      [createdOrUpdated === 'created' ? 'created_at' : 'modified_at']:
        isoDateWithoutMs,
    };

    while (true) {
      try {
        const {
          data: { data: deals, paging },
        } = await this.roApp.instance.get(`/orders`, { params });

        yield deals.map((deal: unknown) => OrderSchema.parse(deal));

        const { page, total_pages } = paging;
        if (page === total_pages) break;

        params.requestPage++;
        await delay(500);
      } catch (error) {
        console.log(error);
        throw new BadGatewayException(
          `Failed to fetch sources from Roapp: ${error.message}`,
        );
      }
    }
  }

  async fetchOrderItems(
    orderId: number,
  ): Promise<z.infer<typeof OrderItemSchema>[]> {
    try {
      const { data: items } = await this.roApp.instance.get(
        `/orders/${orderId}/items`,
      );
      return items.map((item: unknown) => OrderItemSchema.parse(item));
    } catch (error) {
      throw new BadGatewayException(
        `Failed to fetch sources from Roapp: ${error.message}`,
      );
    }
  }

  async *fetchServices() {
    let requestPage = 1;

    while (true) {
      try {
        const {
          data: { data: services, paging },
        } = await this.roApp.instance.get('/catalog/services', {
          params: { page: requestPage },
        });

        yield services.map((service: unknown) => ServiceSchema.parse(service));

        const { page, total_pages } = paging;
        if (page === total_pages) break;

        requestPage++;
        await delay(500);
      } catch (error) {
        throw new BadGatewayException(
          `Failed to fetch sources from Roapp: ${error.message}`,
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
        } = await this.roApp.instance.get('/catalog/products', {
          params: { page: requestPage },
        });

        yield services.map((service: unknown) => ProductSchema.parse(service));

        const { page, total_pages } = paging;
        if (page === total_pages) break;

        requestPage++;
        await delay(500);
      } catch (error) {
        throw new BadGatewayException(
          `Failed to fetch sources from Roapp: ${error.message}`,
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
        } = await this.roApp.instance.get(url, {
          params: { page: requestPage },
        });

        yield serviceCatalog.map((item: unknown) => CategorySchema.parse(item));

        const { page, total_pages } = paging;
        if (page === total_pages) break;

        requestPage++;
        await delay(500);
      } catch (error) {
        throw new BadGatewayException(
          `Failed to fetch sources from Roapp: ${error.message}`,
        );
      }
    }
  }

  async fetchEmployees(): Promise<z.infer<typeof EmployeesShortSchema>[]> {
    try {
      const {
        data: { data: employees },
      } = await this.roApp.instance.get('/company/employees');
      return employees.map((employee: unknown) =>
        EmployeesShortSchema.parse(employee),
      );
    } catch (error) {
      throw new BadGatewayException(
        `Failed to fetch sources from Roapp: ${error.message}`,
      );
    }
  }

  async fetchOrderTypes(): Promise<z.infer<typeof OrderTypesSchema>[]> {
    try {
      const { data: orderTypes } =
        await this.roApp.instance.get('/orders/types');
      return orderTypes.map((orderType: unknown) =>
        OrderTypesSchema.parse(orderType),
      );
    } catch (error) {
      throw new BadGatewayException(
        `Failed to fetch orderTypes from Roapp: ${error.message}`,
      );
    }
  }

  async fetchOrderStatuses(): Promise<z.infer<typeof OrderStatusesSchema>[]> {
    try {
      const { data: orderTypes } =
        await this.roApp.instance.get('/orders/statuses');
      return orderTypes.map((orderType: unknown) =>
        OrderStatusesSchema.parse(orderType),
      );
    } catch (error) {
      throw new BadGatewayException(
        `Failed to fetch sources from Roapp: ${error.message}`,
      );
    }
  }

  async fetchMarketingSources(): Promise<
    z.infer<typeof MarketingSourcesShortSchema>[]
  > {
    try {
      const res = await fetch('https://api.roapp.io/marketing/campaigns/', {
        headers: { Authorization: `Bearer ${process.env.ROAPP_TOKEN}` },
      });
      const { data: marketingSources } = await res.json();
      return marketingSources.map((marketingSource: unknown) =>
        MarketingSourcesShortSchema.parse(marketingSource),
      );
    } catch (error) {
      throw new BadGatewayException(
        `Failed to fetch sources from Roapp: ${error.message}`,
      );
    }
  }
}
