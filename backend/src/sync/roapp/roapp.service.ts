import { Injectable, InternalServerErrorException } from '@nestjs/common';
import { z } from 'zod';
import { DatabaseService } from '../../database/database.service';
import { RoappService } from '../../integrations/roapp/roapp.service';
import { CustomApiRoappService } from '../../integrations/custom-api-roapp/custom-api-roapp.service';
import { ServiceBonusById } from '../../integrations/custom-api-roapp/schemas/serviceBonusById.schema';
import { OrderSchema } from '../../integrations/roapp/schemas/orders.schema';
import { OrderItemSchema } from '../../integrations/roapp/schemas/orderItems.schema';
import { UploadLogger } from '../../utils/logger';
import { delay } from '../../utils/delay';

type ParsedOrder = z.infer<typeof OrderSchema>;
type ParsedOrderItem = z.infer<typeof OrderItemSchema>;
type ProductItem = Extract<ParsedOrderItem, { productId: number }>;
type ServiceItem = Extract<ParsedOrderItem, { serviceId: number }>;

@Injectable()
export class RoappSyncService {
  constructor(
    private readonly DB: DatabaseService,
    private readonly Roapp: RoappService,
    private readonly CustomApiRoapp: CustomApiRoappService,
  ) {}

  async uploadEmployees() {
    try {
      const employees = await this.Roapp.fetchEmployees();
      await Promise.all(
        employees.map((e) =>
          this.DB.roappEmployee.upsert({
            where: { id: e.id },
            create: {
              id: e.id,
              firstName: e.first_name,
              lastName: e.last_name,
            },
            update: { firstName: e.first_name, lastName: e.last_name },
          }),
        ),
      );
      return employees.length;
    } catch (err) {
      throw new InternalServerErrorException(
        `Ошибка синхронизации сотрудников: ${err instanceof Error ? err.message : String(err)}`,
      );
    }
  }

  async uploadOrderStatuses() {
    try {
      const statuses = await this.Roapp.fetchOrderStatuses();
      await Promise.all(
        statuses.map((s) =>
          this.DB.roappOrderStatus.upsert({
            where: { id: s.id },
            create: {
              id: s.id,
              name: s.name,
              color: s.color,
              grupName: s.group,
            },
            update: { name: s.name, color: s.color, grupName: s.group },
          }),
        ),
      );
      return statuses.length;
    } catch (err) {
      throw new InternalServerErrorException(
        `Ошибка синхронизации статусов заказов: ${err instanceof Error ? err.message : String(err)}`,
      );
    }
  }

  async uploadOrderTypes() {
    try {
      const types = await this.Roapp.fetchOrderTypes();
      await Promise.all(
        types.map((t) =>
          this.DB.roappOrderType.upsert({
            where: { id: t.id },
            create: { id: t.id, name: t.title },
            update: { name: t.title },
          }),
        ),
      );
      return types.length;
    } catch (err) {
      throw new InternalServerErrorException(
        `Ошибка синхронизации типов заказов: ${err instanceof Error ? err.message : String(err)}`,
      );
    }
  }

  async uploadMarketingSources() {
    try {
      const sources = await this.Roapp.fetchMarketingSources();
      await Promise.all(
        sources.map((s) =>
          this.DB.roappMarketingSource.upsert({
            where: { id: s.id },
            create: { id: s.id, name: s.name },
            update: { name: s.name },
          }),
        ),
      );
      return sources.length;
    } catch (err) {
      throw new InternalServerErrorException(
        `Ошибка синхронизации маркетинговых источников: ${err instanceof Error ? err.message : String(err)}`,
      );
    }
  }

  async uploadServiceCategories() {
    const log = new UploadLogger('Категории услуг');
    log.start();
    try {
      const all: { id: number; title: string; parent_id: number | null }[] = [];
      for await (const batch of this.Roapp.fetchServicesCategories()) {
        all.push(...batch);
      }

      const sorted = this.topoSort(all);
      for (const c of sorted) {
        await this.DB.roappServiceCategory.upsert({
          where: { id: c.id },
          create: { id: c.id, name: c.title, parentId: c.parent_id },
          update: { name: c.title, parentId: c.parent_id },
        });
        log.tick(1);
      }
      log.done();
    } catch (err) {
      log.error(err instanceof Error ? err : new Error(String(err)));
      throw err;
    }
  }

  async uploadProductCategories() {
    const log = new UploadLogger('Категории продуктов');
    log.start();
    try {
      const all: { id: number; title: string; parent_id: number | null }[] = [];
      for await (const batch of this.Roapp.fetchProductsCategories()) {
        all.push(...batch);
      }

      const sorted = this.topoSort(all);
      for (const c of sorted) {
        await this.DB.roappProductCategory.upsert({
          where: { id: c.id },
          create: { id: c.id, name: c.title, parentId: c.parent_id },
          update: { name: c.title, parentId: c.parent_id },
        });
        log.tick(1);
      }
      log.done();
    } catch (err) {
      log.error(err instanceof Error ? err : new Error(String(err)));
      throw err;
    }
  }

  async uploadServices() {
    const log = new UploadLogger('Услуги');
    log.start();

    try {
      // Загружаем все категории один раз
      const allCategories = await this.DB.roappServiceCategory.findMany();
      const categoryMap = new Map(allCategories.map((c) => [c.id, c]));

      // Поднимаемся по дереву и раскладываем по уровням
      const resolveAncestors = (categoryId: number | null) => {
        if (!categoryId)
          return {
            workTypeId: null,
            brandId: null,
            deviceId: null,
            serviceTypeId: null,
            seriesId: null,
          };

        const path: number[] = [];
        let current = categoryMap.get(categoryId);

        while (current) {
          path.unshift(current.id);
          current = current.parentId
            ? categoryMap.get(current.parentId)
            : undefined;
        }

        // path = [корень(0), workType(1), brand(2), device(3), serviceType(4), series(5), category(6)]
        return {
          workTypeId: path[1] ?? null,
          brandId: path[2] ?? null,
          deviceId: path[3] ?? null,
          serviceTypeId: path[4] ?? null,
          seriesId: path[5] ?? null,
        };
      };

      for await (const services of this.Roapp.fetchServices()) {
        await Promise.all(
          services.map((s) => {
            const ancestors = resolveAncestors(s.categoryId ?? null);

            return this.DB.roappService.upsert({
              where: { id: s.id },
              create: {
                id: s.id,
                name: s.name,
                engeneerBonus: 0,
                price: s.price ?? 0,
                warranty: s.warranty,
                duration: s.duration,
                inCatalog: true,
                categoryId: s.categoryId ?? null,
                workTypeId: ancestors.workTypeId,
                brandId: ancestors.brandId,
                deviceId: ancestors.deviceId,
                serviceTypeId: ancestors.serviceTypeId,
                seriesId: ancestors.seriesId,
              },
              update: {
                categoryId: s.categoryId ?? null,
                workTypeId: ancestors.workTypeId,
                brandId: ancestors.brandId,
                deviceId: ancestors.deviceId,
                serviceTypeId: ancestors.serviceTypeId,
                seriesId: ancestors.seriesId,
              },
            });
          }),
        );
        log.tick(services.length);
      }

      log.done();
    } catch (err) {
      log.error(err instanceof Error ? err : new Error(String(err)));
      throw err;
    }
  }

  async uploadProducts() {
    const log = new UploadLogger('Продукты');
    log.start();
    try {
      for await (const products of this.Roapp.fetchProducts()) {
        await Promise.all(
          products.map((p) =>
            this.DB.roappProduct.upsert({
              where: { id: p.id },
              create: {
                id: p.id,
                name: p.name,
                engeneerBonus: p.engeneerBonus,
                price: p.price,
                categoryId: p.categoryId,
              },
              update: {
                name: p.name,
                engeneerBonus: p.engeneerBonus,
                price: p.price,
                categoryId: p.categoryId,
              },
            }),
          ),
        );
        log.tick(products.length);
      }
      log.done();
    } catch (err) {
      log.error(err instanceof Error ? err : new Error(String(err)));
      throw err;
    }
  }

  async uploadCreatedOrders(fromDate?: Date) {
    return this._uploadOrders(fromDate, (d) =>
      this.Roapp.fetchCreatedOrders(d, 'created'),
    );
  }

  async uploadUpdatedOrders(fromDate?: Date) {
    return this._uploadOrders(fromDate, (d) =>
      this.Roapp.fetchUpdatedOrders(d, 'updated'),
    );
  }

  private async _uploadOrders(
    fromDate: Date | undefined,
    fetcher: (fromDate: Date | undefined) => AsyncGenerator<ParsedOrder[]>,
  ): Promise<number[]> {
    const log = new UploadLogger('Заказы');
    const uploadedIds: number[] = [];
    log.start();
    try {
      for await (const orders of fetcher(fromDate)) {
        await Promise.all(
          orders.map(({ id, ...fields }) =>
            this.DB.roappOrder.upsert({
              where: { id },
              create: { id, ...fields },
              update: fields,
            }),
          ),
        );
        uploadedIds.push(...orders.map((o) => o.id));
        log.tick(orders.length);
      }
      log.done();
    } catch (err) {
      log.error(err instanceof Error ? err : new Error(String(err)));
      throw err;
    }
    return uploadedIds;
  }

  async uploadOrderItems(orderIds?: number[]) {
    const orders = await this.getOrdersToUpdateItems(orderIds);
    const serviceBonusById = await this.getServicesIdsAndEngeneerSalary();

    const log = new UploadLogger('Позиции заказов');
    log.start();

    try {
      for (const order of orders) {
        const itemsCount = await this.uploadOrderItem(order, serviceBonusById);
        log.tick(itemsCount);
        await delay(500);
      }
      log.done();
    } catch (err) {
      log.error(err instanceof Error ? err : new Error(String(err)));
      throw err;
    }
  }

  private async uploadOrderItem(
    order: { id: number; payed: number | null },
    serviceBonusById: Map<number, number>,
  ) {
    const items = (await this.Roapp.fetchOrderItems(order.id)).filter(
      (item): item is NonNullable<typeof item> => item != null,
    );

    const products = items.filter(
      (item): item is ProductItem => 'productId' in item,
    );
    const services = items.filter(
      (item): item is ServiceItem =>
        'serviceId' in item && item.inCatalog === true,
    );
    const hiddenServices = items.filter(
      (item): item is ServiceItem =>
        'serviceId' in item && item.inCatalog === false,
    );

    const missingServiceIds = [
      ...new Set(
        services
          .map((s) => s.serviceId)
          .filter((id) => !serviceBonusById.has(id)),
      ),
    ];

    const missingServices: ServiceBonusById[] = [];
    for (const id of missingServiceIds) {
      const service = await this.CustomApiRoapp.getServiceBonusById(id);
      if (!service) continue;
      missingServices.push(service);
      serviceBonusById.set(service.id, service.bonus);
    }

    const existingProductIds = products.length
      ? new Set(
          (
            await this.DB.roappProduct.findMany({
              where: { id: { in: products.map((p) => p.productId) } },
              select: { id: true },
            })
          ).map((p) => p.id),
        )
      : new Set<number>();

    const validProducts = products.filter((p) =>
      existingProductIds.has(p.productId),
    );

    await this.DB.$transaction(async (tx) => {
      await tx.roappProductsOrder.deleteMany({
        where: { orderId: order.id },
      });
      await tx.roappServiceOrder.deleteMany({
        where: { orderId: order.id },
      });

      if (validProducts.length) {
        await tx.roappProductsOrder.createMany({
          data: validProducts.map((p) => ({
            orderId: order.id,
            productId: p.productId,
            quantity: p.quantity,
            price: p.price,
            cost: p.cost,
            engineerId: p.engineerId,
          })),
        });
      }

      if (missingServices.length) {
        await tx.roappService.createMany({
          data: missingServices.map((service) => ({
            id: service.id,
            name: service.name,
            engeneerBonus: service.bonus,
            price: service.price,
            warranty: service.warranty,
            duration: service.durationHours,
            inCatalog: true,
            categoryId: service.categoryId,
          })),
        });
      }

      if (hiddenServices.length) {
        await tx.roappService.createMany({
          data: hiddenServices.map((service) => ({
            id: service.serviceId,
            name: service.serviceName,
            engeneerBonus: 0,
            price: service.price,
            warranty: '',
            duration: 0,
            inCatalog: false,
            categoryId: null,
          })),
          skipDuplicates: true,
        });
      }

      const serviceRows = services
        .filter((s) => serviceBonusById.has(s.serviceId))
        .map((s) => ({
          orderId: order.id,
          serviceId: s.serviceId,
          quantity: s.quantity,
          price: s.price,
          cost: s.cost,
          discount: s.discount,
          inCatalog: s.inCatalog,
          engineerId: s.engineerId,
          engeneerSalary: serviceBonusById.get(s.serviceId)! * s.quantity,
        }));

      if (serviceRows.length) {
        await tx.roappServiceOrder.createMany({ data: serviceRows });
      }

      const { cost, engineerSalary, managerSalary } = this.calculateOrderKPIs(
        products,
        serviceRows,
        order.payed,
      );

      await tx.roappOrder.update({
        where: { id: order.id },
        data: { cost, engineerSalary, managerSalary },
      });
    });

    return items.length;
  }

  private async getOrdersToUpdateItems(orderIds?: number[]) {
    if (orderIds) {
      return this.DB.roappOrder.findMany({
        where: { id: { in: orderIds }, managerSalary: null },
        select: { id: true, payed: true },
      });
    }
    return this.DB.roappOrder.findMany({
      select: { id: true, payed: true },
    });
  }

  private async getServicesIdsAndEngeneerSalary() {
    return new Map(
      (
        await this.DB.roappService.findMany({
          select: { id: true, engeneerBonus: true },
        })
      ).map((s) => [s.id, s.engeneerBonus]),
    );
  }

  private calculateOrderKPIs(
    products: ProductItem[],
    serviceRows: { engeneerSalary: number }[],
    payed: number | null,
  ) {
    const cost = Math.round(
      products.reduce((sum, p) => sum + p.cost * p.quantity, 0),
    );
    const engineerSalary = serviceRows.reduce(
      (sum, s) => sum + s.engeneerSalary,
      0,
    );
    const managerSalary = Math.round(
      0.1 * ((payed ?? 0) - cost - engineerSalary),
    );

    return { cost, engineerSalary, managerSalary };
  }

  private topoSort<T extends { id: number; parent_id: number | null }>(
    items: T[],
  ): T[] {
    const map = new Map(items.map((i) => [i.id, i]));
    const visited = new Set<number>();
    const result: T[] = [];

    const visit = (item: T) => {
      if (visited.has(item.id)) return;
      if (item.parent_id !== null && map.has(item.parent_id)) {
        visit(map.get(item.parent_id)!);
      }
      visited.add(item.id);
      result.push(item);
    };

    items.forEach(visit);
    return result;
  }
}
