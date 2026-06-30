import { Injectable } from '@nestjs/common';
import { z } from 'zod';
import { DatabaseService } from '../../database/database.service';
import { MoyskladService } from '../../integrations/moySklad/moysklad.service';
import { UploadLogger } from '../../utils/logger';
import { ProductFolderSchema } from '../../integrations/moySklad/schemas/productFolders.schema';

type ParsedFolder = z.infer<typeof ProductFolderSchema>;

const ONLINE_MANAGER_ATTR_ID = '3d26eddb-e7c9-11ef-0a80-04b40036c7c1';

function extractIdFromHref(href: string | null | undefined): string | null {
  if (!href) return null;
  return href.split('/').at(-1) ?? null;
}

@Injectable()
export class MoySkladSyncService {
  constructor(
    private readonly DB: DatabaseService,
    private readonly MoySklad: MoyskladService,
  ) {}

  async uploadEmployees() {
    const log = new UploadLogger('МойСклад: Сотрудники');
    log.start();
    try {
      const employees = await this.MoySklad.fetchEmployees();
      await Promise.all(
        employees.map((e) =>
          this.DB.moySkladEmployee.upsert({
            where: { id: e.id },
            create: {
              id: e.id,
              name: e.name,
              firstName: e.firstName,
              lastName: e.lastName,
              middleName: e.middleName,
              email: e.email,
              phone: e.phone,
              position: e.position,
              archived: e.archived,
            },
            update: {
              name: e.name,
              firstName: e.firstName,
              lastName: e.lastName,
              middleName: e.middleName,
              email: e.email,
              phone: e.phone,
              position: e.position,
              archived: e.archived,
            },
          }),
        ),
      );
      log.tick(employees.length);
      log.done();
    } catch (err) {
      log.error(err instanceof Error ? err : new Error(String(err)));
      throw err;
    }
  }

  async uploadProductFolders() {
    const log = new UploadLogger('МойСклад: Категории');
    log.start();
    try {
      const all: ParsedFolder[] = [];
      for await (const batch of this.MoySklad.fetchProductFolders()) {
        all.push(...batch);
      }

      const sorted = this.topoSort(all);
      for (const f of sorted) {
        await this.DB.moySkladProductFolder.upsert({
          where: { id: f.id },
          create: {
            id: f.id,
            name: f.name,
            pathName: f.pathName,
            parentId: f.parentId,
            archived: f.archived,
          },
          update: {
            name: f.name,
            pathName: f.pathName,
            parentId: f.parentId,
            archived: f.archived,
          },
        });
        log.tick(1);
      }
      log.done();
    } catch (err) {
      log.error(err instanceof Error ? err : new Error(String(err)));
      throw err;
    }
  }

  async uploadProducts() {
    const log = new UploadLogger('МойСклад: Товары');
    log.start();
    try {
      for await (const batch of this.MoySklad.fetchProducts()) {
        await Promise.all(
          batch.map((p) =>
            this.DB.moySkladProduct.upsert({
              where: { id: p.id },
              create: {
                id: p.id,
                name: p.name,
                code: p.code,
                article: p.article,
                description: p.description || null,
                salePrice: Math.round(p.salePrice ?? 0),
                buyPrice: Math.round(p.buyPrice ?? 0),
                folderId: extractIdFromHref(p.productFolderHref),
                archived: p.archived,
                updatedAt: new Date(p.updatedAt),
              },
              update: {
                name: p.name,
                code: p.code,
                article: p.article,
                description: p.description || null,
                salePrice: Math.round(p.salePrice ?? 0),
                buyPrice: Math.round(p.buyPrice ?? 0),
                folderId: extractIdFromHref(p.productFolderHref),
                archived: p.archived,
                updatedAt: new Date(p.updatedAt),
              },
            }),
          ),
        );
        log.tick(batch.length);
      }
      log.done();
    } catch (err) {
      log.error(err instanceof Error ? err : new Error(String(err)));
      throw err;
    }
  }

  async uploadServices() {
    const log = new UploadLogger('МойСклад: Услуги');
    log.start();
    try {
      for await (const batch of this.MoySklad.fetchServices()) {
        await Promise.all(
          batch.map((s) =>
            this.DB.moySkladService.upsert({
              where: { id: s.id },
              create: {
                id: s.id,
                name: s.name,
                code: s.code,
                description: s.description || null,
                salePrice: Math.round(s.salePrice ?? 0),
                folderId: extractIdFromHref(s.productFolderHref),
                archived: s.archived,
                updatedAt: new Date(s.updatedAt),
              },
              update: {
                name: s.name,
                code: s.code,
                description: s.description || null,
                salePrice: Math.round(s.salePrice ?? 0),
                folderId: extractIdFromHref(s.productFolderHref),
                archived: s.archived,
                updatedAt: new Date(s.updatedAt),
              },
            }),
          ),
        );
        log.tick(batch.length);
      }
      log.done();
    } catch (err) {
      log.error(err instanceof Error ? err : new Error(String(err)));
      throw err;
    }
  }

  async uploadDemands(fromDate?: Date) {
    const log = new UploadLogger('МойСклад: Отгрузки');
    log.start();
    try {
      for await (const batch of this.MoySklad.fetchDemands(fromDate)) {
        for (const demand of batch) {
          const onlineManagerAttr = demand.attributes?.find(
            (a) => a.id === ONLINE_MANAGER_ATTR_ID,
          );
          const onlineManagerId =
            onlineManagerAttr?.type === 'employee' &&
            onlineManagerAttr.value != null
              ? extractIdFromHref(
                  (onlineManagerAttr.value as { meta: { href: string } }).meta
                    .href,
                )
              : null;

          const offlineManagerId = extractIdFromHref(demand.owner.meta.href);
          const agentId = extractIdFromHref(demand.agent.meta.href);
          const salesChannelId = demand.salesChannel
            ? extractIdFromHref(demand.salesChannel.meta.href)
            : null;
          const stateId = demand.state
            ? extractIdFromHref(demand.state.meta.href)
            : null;
          const customerOrderId = demand.customerOrder
            ? extractIdFromHref(demand.customerOrder.meta.href)
            : null;

          const positions = demand.positions.rows ?? [];

          await this.DB.$transaction(async (tx) => {
            await tx.moySkladDemand.upsert({
              where: { id: demand.id },
              create: {
                id: demand.id,
                name: demand.name,
                moment: new Date(demand.moment),
                createdAt: new Date(demand.created),
                sum: Math.round(demand.sum),
                payedSum: Math.round(demand.payedSum),
                agentId,
                agentName: null,
                stateId,
                stateName: null,
                salesChannelId,
                salesChannelName: null,
                onlineManagerId,
                offlineManagerId,
                customerOrderId,
                description: demand.description ?? null,
              },
              update: {
                name: demand.name,
                moment: new Date(demand.moment),
                sum: Math.round(demand.sum),
                payedSum: Math.round(demand.payedSum),
                agentId,
                stateId,
                salesChannelId,
                onlineManagerId,
                offlineManagerId,
                customerOrderId,
                description: demand.description ?? null,
              },
            });

            await tx.moySkladDemandPosition.deleteMany({
              where: { demandId: demand.id },
            });

            const validPositions = positions.filter(
              (p) => p.assortment != null,
            );

            if (validPositions.length) {
              const productPositions = validPositions.filter(
                (p) => p.assortment!.meta.type === 'product',
              );
              const servicePositions = validPositions.filter(
                (p) => p.assortment!.meta.type === 'service',
              );

              if (productPositions.length) {
                const existingProductIds = new Set(
                  (
                    await tx.moySkladProduct.findMany({
                      where: {
                        id: { in: productPositions.map((p) => p.assortment!.id) },
                      },
                      select: { id: true },
                    })
                  ).map((p) => p.id),
                );
                const missingProducts = productPositions.filter(
                  (p) => !existingProductIds.has(p.assortment!.id),
                );
                if (missingProducts.length) {
                  await tx.moySkladProduct.createMany({
                    data: missingProducts.map((p) => ({
                      id: p.assortment!.id,
                      name: p.assortment!.name,
                      salePrice: 0,
                      buyPrice: 0,
                      archived: false,
                      updatedAt: new Date(),
                    })),
                    skipDuplicates: true,
                  });
                }
              }

              if (servicePositions.length) {
                const existingServiceIds = new Set(
                  (
                    await tx.moySkladService.findMany({
                      where: {
                        id: { in: servicePositions.map((p) => p.assortment!.id) },
                      },
                      select: { id: true },
                    })
                  ).map((s) => s.id),
                );
                const missingServices = servicePositions.filter(
                  (p) => !existingServiceIds.has(p.assortment!.id),
                );
                if (missingServices.length) {
                  await tx.moySkladService.createMany({
                    data: missingServices.map((p) => ({
                      id: p.assortment!.id,
                      name: p.assortment!.name,
                      salePrice: 0,
                      archived: false,
                      updatedAt: new Date(),
                    })),
                    skipDuplicates: true,
                  });
                }
              }

              const rows = validPositions
                .filter((p) => {
                  const type = p.assortment!.meta.type;
                  return type === 'product' || type === 'service';
                })
                .map((p) => {
                  const qty = p.quantity;
                  const price = Math.round(p.price);
                  const discount = p.discount;
                  const sum = Math.round(price * qty * (1 - discount / 100));
                  const buyPrice = Math.round(p.stock?.cost ?? 0);
                  const cost = Math.round(buyPrice * qty);
                  const profit = sum - cost;
                  const assortmentType = p.assortment!.meta.type;

                  return {
                    id: p.id,
                    demandId: demand.id,
                    productId:
                      assortmentType === 'product' ? p.assortment!.id : null,
                    serviceId:
                      assortmentType === 'service' ? p.assortment!.id : null,
                    assortmentName: p.assortment!.name,
                    quantity: qty,
                    price,
                    discount,
                    sum,
                    cost,
                    profit,
                  };
                });

              if (rows.length) {
                await tx.moySkladDemandPosition.createMany({ data: rows });
              }
            }
          });

          log.tick(1);
        }
      }
      log.done();
    } catch (err) {
      log.error(err instanceof Error ? err : new Error(String(err)));
      throw err;
    }
  }

  private topoSort<T extends { id: string; parentId: string | null }>(
    items: T[],
  ): T[] {
    const map = new Map(items.map((i) => [i.id, i]));
    const visited = new Set<string>();
    const result: T[] = [];

    const visit = (item: T) => {
      if (visited.has(item.id)) return;
      if (item.parentId && map.has(item.parentId)) {
        visit(map.get(item.parentId)!);
      }
      visited.add(item.id);
      result.push(item);
    };

    items.forEach(visit);
    return result;
  }
}
