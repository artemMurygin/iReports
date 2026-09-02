import {
    Inject,
    Injectable,
    InternalServerErrorException,
} from '@nestjs/common';
import { DatabaseService } from '../../../../infrustructure/database/database.service';
import { UploadLogger } from '../../../../shared/logger';
import { delay } from '../../../../shared/delay';
import { ROAPP_GATEWAY } from '../../integrations/roapp-gateway/roapp-gateway.port';
import type {
    RoappGateway,
    Order,
    OrderItem,
} from '../../integrations/roapp-gateway/roapp-gateway.port';
import type { ServiceBonusById } from '../../integrations/custom-api-roapp/schemas/serviceBonusById.schema';
import {
    mapEmployeeToUpsert,
    mapOrderStatusToUpsert,
    mapOrderTypeToUpsert,
    mapMarketingSourceToUpsert,
    topoSortCategories,
    resolveServiceCategoryAncestors,
} from './roapp-sync.mappers';

type ProductItem = Extract<OrderItem, { productId: number }>;
type ServiceItem = Extract<OrderItem, { serviceId: number }>;

@Injectable()
export class RoappSyncService {
    constructor(
        private readonly db: DatabaseService,
        @Inject(ROAPP_GATEWAY) private readonly roapp: RoappGateway,
    ) {}

    async uploadEmployees() {
        try {
            const employees = await this.roapp.fetchEmployees();
            await Promise.all(
                employees.map((e) => {
                    const data = mapEmployeeToUpsert(e);
                    return this.db.roappEmployee.upsert({
                        where: { id: data.id },
                        create: data,
                        update: {
                            firstName: data.firstName,
                            lastName: data.lastName,
                        },
                    });
                }),
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
            const statuses = await this.roapp.fetchOrderStatuses();
            await Promise.all(
                statuses.map((s) => {
                    const data = mapOrderStatusToUpsert(s);
                    return this.db.roappOrderStatus.upsert({
                        where: { id: data.id },
                        create: data,
                        update: {
                            name: data.name,
                            color: data.color,
                            grupName: data.grupName,
                        },
                    });
                }),
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
            const types = await this.roapp.fetchOrderTypes();
            await Promise.all(
                types.map((t) => {
                    const data = mapOrderTypeToUpsert(t);
                    return this.db.roappOrderType.upsert({
                        where: { id: data.id },
                        create: data,
                        update: { name: data.name },
                    });
                }),
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
            const sources = await this.roapp.fetchMarketingSources();
            await Promise.all(
                sources.map((s) => {
                    const data = mapMarketingSourceToUpsert(s);
                    return this.db.roappMarketingSource.upsert({
                        where: { id: data.id },
                        create: data,
                        update: { name: data.name },
                    });
                }),
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
            const all: {
                id: number;
                title: string;
                parent_id: number | null;
            }[] = [];
            for await (const batch of this.roapp.fetchServiceCategories()) {
                all.push(...batch);
            }

            const sorted = topoSortCategories(all);
            for (const c of sorted) {
                await this.db.roappServiceCategory.upsert({
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
            const all: {
                id: number;
                title: string;
                parent_id: number | null;
            }[] = [];
            for await (const batch of this.roapp.fetchProductCategories()) {
                all.push(...batch);
            }

            const sorted = topoSortCategories(all);
            for (const c of sorted) {
                await this.db.roappProductCategory.upsert({
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
            const allCategories = await this.db.roappServiceCategory.findMany();
            const categoryMap = new Map(allCategories.map((c) => [c.id, c]));

            for await (const services of this.roapp.fetchServices()) {
                await Promise.all(
                    services.map((s) => {
                        const ancestors = resolveServiceCategoryAncestors(
                            s.categoryId ?? null,
                            categoryMap,
                        );

                        return this.db.roappService.upsert({
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
            for await (const products of this.roapp.fetchProducts()) {
                await Promise.all(
                    products.map((p) =>
                        this.db.roappProduct.upsert({
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
            this.roapp.fetchCreatedOrders(d),
        );
    }

    async uploadUpdatedOrders(fromDate?: Date) {
        return this._uploadOrders(fromDate, (d) =>
            this.roapp.fetchUpdatedOrders(d),
        );
    }

    // Синк месяца по требованию (закрытие расчётного периода, PRD 1
    // docs/payroll-closing-and-accrual): заказы, закрытые в [from, to], и
    // их позиции. Штамп DomainSyncStatus здесь НЕ ставится — это не полный
    // проход крона, а точечное обновление диапазона; закрытие само сбрасывает
    // кэш расчёта после синка.
    async uploadOrdersClosedBetween(from: Date, to: Date): Promise<number[]> {
        const orderIds = await this._uploadOrders(undefined, () =>
            this.roapp.fetchOrdersClosedBetween(from, to),
        );
        await this.uploadOrderItems(orderIds);
        return orderIds;
    }

    private async _uploadOrders(
        fromDate: Date | undefined,
        fetcher: (fromDate: Date | undefined) => AsyncGenerator<Order[]>,
    ): Promise<number[]> {
        const log = new UploadLogger('Заказы');
        const uploadedIds: number[] = [];
        log.start();
        try {
            for await (const orders of fetcher(fromDate)) {
                await Promise.all(
                    orders.map(({ id, ...fields }) =>
                        this.db.roappOrder.upsert({
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
                const itemsCount = await this.uploadOrderItem(
                    order,
                    serviceBonusById,
                );
                log.tick(itemsCount);
                await delay(500);
            }
            log.done();
        } catch (err) {
            log.error(err instanceof Error ? err : new Error(String(err)));
            throw err;
        }
    }

    async uploadServiceBonuses() {
        const log = new UploadLogger('Обновляю начисление в услугах');
        log.start();
        try {
            const bonuses = await this.roapp.fetchServiceBonuses();
            for (const bonus of bonuses) {
                await this.db.roappService.update({
                    where: { id: bonus.id },
                    data: { engeneerBonus: bonus.bonus },
                });
                log.tick(1);
            }
            log.done();
        } catch (error) {
            log.error(
                error instanceof Error ? error : new Error(String(error)),
            );
            throw error;
        }
    }

    private async uploadOrderItem(
        order: { id: number; payed: number | null },
        serviceBonusById: Map<number, number>,
    ) {
        const items = await this.roapp.fetchOrderItems(order.id);

        const products = items.filter(
            (item): item is ProductItem => 'productId' in item,
        );
        const services = items.filter(
            (item): item is ServiceItem =>
                'serviceId' in item && item.inCatalog === true,
        );
        const hiddenServices = items.filter(
            (item): item is ServiceItem =>
                'serviceId' in item && !item.inCatalog,
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
            const service = await this.roapp.fetchServiceBonusById(id);
            if (!service) continue;
            missingServices.push(service);
            serviceBonusById.set(service.id, service.bonus);
        }

        const existingProductIds = products.length
            ? new Set(
                  (
                      await this.db.roappProduct.findMany({
                          where: {
                              id: { in: products.map((p) => p.productId) },
                          },
                          select: { id: true },
                      })
                  ).map((p) => p.id),
              )
            : new Set<number>();

        const validProducts = products.filter((p) =>
            existingProductIds.has(p.productId),
        );

        await this.db.$transaction(async (tx) => {
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
                    engeneerSalary:
                        serviceBonusById.get(s.serviceId)! * s.quantity,
                }));

            if (serviceRows.length) {
                await tx.roappServiceOrder.createMany({ data: serviceRows });
            }

            const { cost, engineerSalary, managerSalary } =
                this.calculateOrderKPIs(products, serviceRows, order.payed);

            await tx.roappOrder.update({
                where: { id: order.id },
                data: { cost, engineerSalary, managerSalary },
            });
        });

        return items.length;
    }

    private async getOrdersToUpdateItems(orderIds?: number[]) {
        return this.db.roappOrder.findMany({
            where: orderIds ? { id: { in: orderIds } } : undefined,
            select: { id: true, payed: true },
        });
    }

    private async getServicesIdsAndEngeneerSalary() {
        return new Map(
            (
                await this.db.roappService.findMany({
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
}
