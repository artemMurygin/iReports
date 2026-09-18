import { randomUUID } from 'crypto';
import { Injectable, Logger } from '@nestjs/common';
import { DatabaseService } from '../../../../infrustructure/database/database.service';
import { UploadLogger } from '../../../../shared/logger';
import { delay } from '../../../../shared/delay';
import { MoyskladService } from '../../integrations/moySklad/moysklad.service';
import type { ProductFolder } from '../../integrations/moySklad/schemas/productFolders.schema';
import type { Demand } from '../../integrations/moySklad/schemas/demands.schema';
import {
    extractIdFromHref,
    extractPurchaserExternalId,
    topoSortFolders,
    ONLINE_MANAGER_ATTR_ID,
    PURCHASER_ATTRIBUTE_NAME,
} from './moysklad-sync.mappers';

// spec: fix-shop-turnover-historical-stock-cost D2 — общий момент начала
// поиска (`momentFrom`) для обоих запросов /report/turnover/* в бэкфилле
// истории остатков (fetchTurnoverAllAt, fetchTurnoverByStoreForProduct).
// Фиксированная дата, заведомо раньше начала работы этого аккаунта в
// МойСклад — не связана с отчётным месяцем и не вычисляется из локальной
// БД, чтобы не потерять товары с остатком, но без движения внутри узкого
// окна конкретного месяца (см. design.md Context/D2 — на реальных данных
// узкое окно теряло ~78% товаров с остатком). Значение подтверждено
// эмпирически в рамках этого изменения (прямые запросы к боевому API,
// сверка с отчётом «Остатки» интерфейса МойСклад — см. design.md Context).
export const HISTORICAL_TURNOVER_LOOKBACK_ANCHOR = new Date(
    '2015-01-01T00:00:00.000Z',
);

@Injectable()
export class MoySkladSyncService {
    private readonly logger = new Logger(MoySkladSyncService.name);

    constructor(
        private readonly db: DatabaseService,
        private readonly moySklad: MoyskladService,
    ) {}

    async uploadEmployees() {
        const log = new UploadLogger('МойСклад: Сотрудники');
        log.start();
        try {
            const employees = await this.moySklad.fetchEmployees();
            await Promise.all(
                employees.map((e) =>
                    this.db.moySkladEmployee.upsert({
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
            const all: ProductFolder[] = [];
            for await (const batch of this.moySklad.fetchProductFolders()) {
                all.push(...batch);
            }

            const sorted = topoSortFolders(all);
            for (const f of sorted) {
                await this.db.moySkladProductFolder.upsert({
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
            for await (const batch of this.moySklad.fetchProducts()) {
                await Promise.all(
                    batch.map((p) => {
                        // spec: shop/moysklad-sync#requirement-закупщик-бу-техники-резолвится-по-значению-доп-поля-карточки-товара
                        const onlinePurchaserId = extractPurchaserExternalId(
                            p.attributes,
                            PURCHASER_ATTRIBUTE_NAME.ONLINE,
                        );
                        const offlinePurchaserId = extractPurchaserExternalId(
                            p.attributes,
                            PURCHASER_ATTRIBUTE_NAME.OFFLINE,
                        );

                        return this.db.moySkladProduct.upsert({
                            where: { id: p.id },
                            create: {
                                id: p.id,
                                name: p.name,
                                code: p.code,
                                article: p.article,
                                description: p.description || null,
                                salePrice: Math.round(p.salePrice ?? 0),
                                buyPrice: Math.round(p.buyPrice ?? 0),
                                folderId: extractIdFromHref(
                                    p.productFolderHref,
                                ),
                                archived: p.archived,
                                updatedAt: new Date(p.updatedAt),
                                onlinePurchaserId,
                                offlinePurchaserId,
                            },
                            update: {
                                name: p.name,
                                code: p.code,
                                article: p.article,
                                description: p.description || null,
                                salePrice: Math.round(p.salePrice ?? 0),
                                buyPrice: Math.round(p.buyPrice ?? 0),
                                folderId: extractIdFromHref(
                                    p.productFolderHref,
                                ),
                                archived: p.archived,
                                updatedAt: new Date(p.updatedAt),
                                onlinePurchaserId,
                                offlinePurchaserId,
                            },
                        });
                    }),
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
            for await (const batch of this.moySklad.fetchServices()) {
                await Promise.all(
                    batch.map((s) =>
                        this.db.moySkladService.upsert({
                            where: { id: s.id },
                            create: {
                                id: s.id,
                                name: s.name,
                                code: s.code,
                                description: s.description || null,
                                salePrice: Math.round(s.salePrice ?? 0),
                                folderId: extractIdFromHref(
                                    s.productFolderHref,
                                ),
                                archived: s.archived,
                                updatedAt: new Date(s.updatedAt),
                            },
                            update: {
                                name: s.name,
                                code: s.code,
                                description: s.description || null,
                                salePrice: Math.round(s.salePrice ?? 0),
                                folderId: extractIdFromHref(
                                    s.productFolderHref,
                                ),
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

    // spec: shop-turnover-report D2 — справочник складов, тот же паттерн
    // апсерта, что и uploadEmployees.
    async uploadStores() {
        const log = new UploadLogger('МойСклад: Склады');
        log.start();
        try {
            for await (const batch of this.moySklad.fetchStores()) {
                await Promise.all(
                    batch.map((s) =>
                        this.db.moySkladStore.upsert({
                            where: { id: s.id },
                            create: { id: s.id, name: s.name },
                            update: { name: s.name },
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

    // spec: shop-turnover-report D5/D7.1 — почасовой снимок остатков.
    // Накопительная (append-only) таблица: каждый прогон пишет НОВЫЙ набор
    // строк с ОБЩИМ snapshotAt (один Date на весь прогон), не трогая
    // (не удаляя, не перезаписывая) строки предыдущих прогонов — обычный
    // upsert-паттерн справочников здесь сознательно не используется.
    async uploadStockSnapshot() {
        const log = new UploadLogger('МойСклад: Остатки (снимок)');
        log.start();
        const snapshotAt = new Date();
        try {
            for await (const batch of this.moySklad.fetchStockByStore()) {
                const data: {
                    id: string;
                    productId: string;
                    warehouseId: string;
                    quantity: number;
                    costSum: number;
                    snapshotAt: Date;
                }[] = [];

                for (const row of batch) {
                    const productId = extractIdFromHref(row.meta.href);
                    if (!productId) continue;

                    for (const entry of row.stockByStore) {
                        const warehouseId = extractIdFromHref(entry.meta.href);
                        if (!warehouseId) continue;

                        data.push({
                            id: randomUUID(),
                            productId,
                            warehouseId,
                            quantity: entry.stock,
                            costSum: Math.round(entry.price),
                            snapshotAt,
                        });
                    }
                }

                if (data.length) {
                    await this.db.moySkladStock.createMany({
                        data,
                        skipDuplicates: true,
                    });
                }
                log.tick(batch.length);
            }
            log.done();
        } catch (err) {
            log.error(err instanceof Error ? err : new Error(String(err)));
            throw err;
        }
    }

    // spec: fix-shop-turnover-historical-stock-cost D1/D3/D4 — разовый
    // бэкфилл истории остатков (`npm run initialProd <date> M`, см.
    // UploadInitialMoySkladDataHandler) за каждый календарный месяц от
    // fromDate до текущего. Двухшаговая логика (design.md D1): шаг 1 —
    // account-wide отчёт "Обороты" (fetchTurnoverAllAt) находит товары с
    // ненулевым остатком на конец месяца; шаг 2 — для каждого такого товара
    // (D3: с нулевым остатком товар не запрашивается повторно) —
    // fetchTurnoverByStoreForProduct отдаёт разбивку по складам, состав
    // складов на конкретный месяц берётся из этого ответа, а не из заранее
    // загруженного справочника MoySkladStore. По одной строке MoySkladStock
    // на каждый склад с ненулевым количеством. Идемпотентен: upsert по
    // (productId, warehouseId, snapshotAt), повторный запуск с тем же
    // диапазоном не создаёт дублей.
    async backfillHistoricalStockSnapshots(fromDate: Date) {
        const log = new UploadLogger('МойСклад: Остатки (бэкфилл истории)');
        log.start();
        try {
            const monthEnds = this._monthEndsFrom(fromDate);

            for (const monthEnd of monthEnds) {
                for await (const batch of this.moySklad.fetchTurnoverAllAt(
                    HISTORICAL_TURNOVER_LOOKBACK_ANCHOR,
                    monthEnd,
                )) {
                    for (const row of batch) {
                        if (row.onPeriodEnd.quantity <= 0) continue;

                        const productId = extractIdFromHref(
                            row.assortment.meta.href,
                        );
                        if (!productId) continue;

                        const stockByStore =
                            await this.moySklad.fetchTurnoverByStoreForProduct(
                                row.assortment.meta.href,
                                row.assortment.meta.type,
                                HISTORICAL_TURNOVER_LOOKBACK_ANCHOR,
                                monthEnd,
                            );
                        // Троттлинг между вызовами на каждый товар (design.md
                        // Risks — «как и остальные постраничные вызовы в
                        // moysklad.service.ts, см. delay(400)/delay(500)»):
                        // без задержки ~500 последовательных запросов на
                        // /report/turnover/bystore за месяц упираются в
                        // rate-limit МойСклад (429/502 Bad Gateway).
                        await delay(400);

                        // spec: fix-shop-turnover-historical-stock-cost D4 —
                        // сверка account-wide (шаг 1) и по-складской (шаг 2)
                        // суммы одного товара; расхождение — предупреждение,
                        // а не исключение, останавливающее весь прогон одной
                        // аномальной строкой.
                        const byStoreSum = stockByStore.reduce(
                            (sum, entry) => sum + entry.costSum,
                            0,
                        );
                        if (byStoreSum !== row.onPeriodEnd.sum) {
                            this.logger.warn(
                                `Расхождение суммы остатка на конец периода у товара ${productId} на ${monthEnd.toISOString()}: ` +
                                    `account-wide (/report/turnover/all)=${row.onPeriodEnd.sum}, по складам (/report/turnover/bystore)=${byStoreSum}`,
                            );
                        }

                        for (const entry of stockByStore) {
                            if (entry.quantity <= 0) continue;

                            await this.db.moySkladStock.upsert({
                                where: {
                                    productId_warehouseId_snapshotAt: {
                                        productId,
                                        warehouseId: entry.warehouseId,
                                        snapshotAt: monthEnd,
                                    },
                                },
                                create: {
                                    id: randomUUID(),
                                    productId,
                                    warehouseId: entry.warehouseId,
                                    quantity: entry.quantity,
                                    costSum: entry.costSum,
                                    snapshotAt: monthEnd,
                                },
                                update: {
                                    quantity: entry.quantity,
                                    costSum: entry.costSum,
                                },
                            });
                            log.tick(1);
                        }
                    }
                }
            }
            log.done();
        } catch (err) {
            log.error(err instanceof Error ? err : new Error(String(err)));
            throw err;
        }
    }

    // Календарные месяцы от fromDate до текущего (включительно), каждый
    // представлен последним моментом месяца в UTC (23:59:59.999) — это и
    // есть `momentTo` обоих запросов /report/turnover/* в
    // backfillHistoricalStockSnapshots (fix-shop-turnover-historical-stock-cost).
    private _monthEndsFrom(fromDate: Date): Date[] {
        const ends: Date[] = [];
        let year = fromDate.getUTCFullYear();
        let month = fromDate.getUTCMonth();
        const now = new Date();

        while (
            year < now.getUTCFullYear() ||
            (year === now.getUTCFullYear() && month <= now.getUTCMonth())
        ) {
            ends.push(new Date(Date.UTC(year, month + 1, 0, 23, 59, 59, 999)));
            month += 1;
            if (month > 11) {
                month = 0;
                year += 1;
            }
        }

        return ends;
    }

    async uploadCreatedDemands(fromDate?: Date) {
        return this._uploadDemands(fromDate, (d) =>
            this.moySklad.fetchCreatedDemands(d),
        );
    }

    async uploadUpdatedDemands(fromDate?: Date) {
        return this._uploadDemands(fromDate, (d) =>
            this.moySklad.fetchUpdatedDemands(d),
        );
    }

    // Синк месяца по требованию (закрытие расчётного периода, PRD 1
    // docs/payroll-closing-and-accrual): отгрузки с moment в [from, to].
    async uploadDemandsByMoment(from: Date, to: Date): Promise<void> {
        await this._uploadDemands(undefined, () =>
            this.moySklad.fetchDemandsByMoment(from, to),
        );
    }

    private async _uploadDemands(
        fromDate: Date | undefined,
        fetcher: (fromDate?: Date) => AsyncGenerator<Demand[]>,
    ) {
        const log = new UploadLogger('МойСклад: Отгрузки');
        log.start();
        try {
            for await (const batch of fetcher(fromDate)) {
                for (const demand of batch) {
                    await this.uploadDemand(demand);
                    log.tick(1);
                }
            }
            log.done();
        } catch (err) {
            log.error(err instanceof Error ? err : new Error(String(err)));
            throw err;
        }
    }

    private async uploadDemand(demand: Demand) {
        const onlineManagerAttr = demand.attributes?.find(
            (a) => a.id === ONLINE_MANAGER_ATTR_ID,
        );
        const onlineManagerId =
            onlineManagerAttr?.type === 'employee' &&
            onlineManagerAttr.value != null
                ? extractIdFromHref(
                      (onlineManagerAttr.value as { meta: { href: string } })
                          .meta.href,
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
        // spec: shop-turnover-report D3 — поле уже приходит в ответе
        // МойСклад, раньше отбрасывалось при апсерте.
        const storeId = demand.store
            ? extractIdFromHref(demand.store.meta.href)
            : null;

        const positions = demand.positions.rows ?? [];

        await this.db.$transaction(async (tx) => {
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
                    storeId,
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
                    storeId,
                    description: demand.description ?? null,
                },
            });

            // spec: shop/moysklad-sync#requirement-позиции-отгрузки-при-синхронизации-полностью-замещаются-а-не-дополняются
            await tx.moySkladDemandPosition.deleteMany({
                where: { demandId: demand.id },
            });

            const validPositions = positions.filter(
                (p) => p.assortment != null,
            );
            if (!validPositions.length) return;

            const productPositions = validPositions.filter(
                (p) =>
                    p.assortment!.meta.type === 'product' ||
                    p.assortment!.meta.type === 'variant',
            );
            const servicePositions = validPositions.filter(
                (p) => p.assortment!.meta.type === 'service',
            );

            if (productPositions.length) {
                const existingProductIds = new Set(
                    (
                        await tx.moySkladProduct.findMany({
                            where: {
                                id: {
                                    in: productPositions.map(
                                        (p) => p.assortment!.id,
                                    ),
                                },
                            },
                            select: { id: true },
                        })
                    ).map((p) => p.id),
                );
                const missingProducts = productPositions.filter(
                    (p) => !existingProductIds.has(p.assortment!.id),
                );
                if (missingProducts.length) {
                    // spec: shop/moysklad-sync#requirement-товар-модификация-отсутствующий-в-каталоге-дозагружается-placeholder-записью-с-категорией-родителя
                    const parentIdByPositionId = new Map(
                        missingProducts.map((p) => [
                            p.id,
                            p.assortment!.meta.type === 'variant'
                                ? extractIdFromHref(
                                      p.assortment!.product?.meta.href,
                                  )
                                : null,
                        ]),
                    );
                    const parentIds = [
                        ...new Set(
                            [...parentIdByPositionId.values()].filter(
                                (id): id is string => id != null,
                            ),
                        ),
                    ];
                    const parentFolderById = new Map(
                        parentIds.length
                            ? (
                                  await tx.moySkladProduct.findMany({
                                      where: { id: { in: parentIds } },
                                      select: { id: true, folderId: true },
                                  })
                              ).map((p) => [p.id, p.folderId])
                            : [],
                    );

                    await tx.moySkladProduct.createMany({
                        data: missingProducts.map((p) => {
                            const parentId =
                                parentIdByPositionId.get(p.id) ?? null;
                            return {
                                id: p.assortment!.id,
                                name: p.assortment!.name,
                                salePrice: 0,
                                buyPrice: 0,
                                folderId: parentId
                                    ? (parentFolderById.get(parentId) ?? null)
                                    : null,
                                archived: false,
                                updatedAt: new Date(),
                            };
                        }),
                        skipDuplicates: true,
                    });
                }
            }

            if (servicePositions.length) {
                const existingServiceIds = new Set(
                    (
                        await tx.moySkladService.findMany({
                            where: {
                                id: {
                                    in: servicePositions.map(
                                        (p) => p.assortment!.id,
                                    ),
                                },
                            },
                            select: { id: true },
                        })
                    ).map((s) => s.id),
                );
                const missingServices = servicePositions.filter(
                    (p) => !existingServiceIds.has(p.assortment!.id),
                );
                if (missingServices.length) {
                    // spec: shop/moysklad-sync#requirement-услуга-отсутствующая-в-каталоге-дозагружается-по-ходу-синхронизации-позиций
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
                    return (
                        type === 'product' ||
                        type === 'variant' ||
                        type === 'service'
                    );
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
                            assortmentType === 'product' ||
                            assortmentType === 'variant'
                                ? p.assortment!.id
                                : null,
                        serviceId:
                            assortmentType === 'service'
                                ? p.assortment!.id
                                : null,
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
        });
    }
}
