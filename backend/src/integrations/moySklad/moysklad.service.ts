import { BadGatewayException, Injectable } from '@nestjs/common';
import { z } from 'zod';
import { MoyskladHttpService } from './moysklad.instance';
import { MoyskladListParams } from './moysklad.types';
import { CustomerOrderSchema } from './schemas/customerOrders.schema';
import { ProductSchema } from './schemas/products.schema';
import { ServiceSchema } from './schemas/services.schema';
import { EmployeeSchema } from './schemas/employees.schema';
import { CounterpartySchema } from './schemas/counterparties.schema';
import { delay } from '../../utils/delay';

const PAGE_LIMIT = 1000;

@Injectable()
export class MoyskladService {
  constructor(private moysklad: MoyskladHttpService) {}

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

  async *fetchServices() {
    yield* this._fetchPaged('/entity/service', ServiceSchema);
  }

  async fetchEmployees(): Promise<z.infer<typeof EmployeeSchema>[]> {
    try {
      const {
        data: { rows },
      } = await this.moysklad.instance.get('/entity/employee', {
        params: { limit: PAGE_LIMIT } satisfies Partial<MoyskladListParams>,
      });
      return rows.map((e: unknown) => EmployeeSchema.parse(e));
    } catch (error) {
      throw new BadGatewayException(
        `Failed to fetch employees from MoySklad: ${error.message}`,
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

  async *fetchAssortment(
    filter?: string,
  ): AsyncGenerator<{ id: string; name: string }[]> {
    let offset = 0;

    while (true) {
      try {
        const params: Record<string, unknown> = { limit: PAGE_LIMIT, offset };
        if (filter) params.filter = filter;

        const {
          data: { rows, meta },
        } = await this.moysklad.instance.get('/entity/assortment', { params });

        yield (rows as { id: string; name: string }[]).map(({ id, name }) => ({
          id,
          name,
        }));

        const fetched = offset + (rows as unknown[]).length;
        if (fetched >= meta.size) break;

        offset = fetched;
        await delay(500);
      } catch (error) {
        throw new BadGatewayException(
          `Failed to fetch assortment from MoySklad: ${error.message}`,
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
      throw new BadGatewayException(
        `Failed to batch update products in MoySklad: ${error.message}`,
      );
    }
  }

  private async *_fetchPaged<T extends z.ZodTypeAny>(
    url: string,
    schema: T,
    updatedFrom?: Date,
  ): AsyncGenerator<z.output<T>[]> {
    let offset = 0;

    const baseParams: Partial<MoyskladListParams> = {
      limit: PAGE_LIMIT,
      ...(updatedFrom && { updatedFrom: updatedFrom.toISOString() }),
    };

    while (true) {
      try {
        const {
          data: { rows, meta },
        } = await this.moysklad.instance.get(url, {
          params: { ...baseParams, offset },
        });

        yield rows.map((row: unknown) => schema.parse(row));

        const fetched = offset + rows.length;
        if (fetched >= meta.size) break;

        offset = fetched;
        await delay(300);
      } catch (error) {
        throw new BadGatewayException(
          `Failed to fetch ${url} from MoySklad: ${error.message}`,
        );
      }
    }
  }
}
