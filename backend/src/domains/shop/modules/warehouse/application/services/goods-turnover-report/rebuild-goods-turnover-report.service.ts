import { Inject, Injectable } from '@nestjs/common';
import { DatabaseService } from '@/infrustructure/database/database.service';
import { Period } from '@/shared/domain/period.value-object';
import { ProductFolderTreeService } from '@/domains/shop/sync/moySklad/product-folder-tree.service';
import { GoodsTurnoverReportLine } from '@/domains/shop/modules/warehouse/domain/entities/goods-turnover-report-line/goods-turnover-report-line.entity';
import { Money } from '@/domains/shop/modules/warehouse/domain/value-objects/money.value-object';
import { GOODS_TURNOVER_REPORT_REPOSITORY } from '@/domains/shop/modules/warehouse/application/ports/goods-turnover-report/goods-turnover-report.port';
import type { GoodsTurnoverReportRepositoryPort } from '@/domains/shop/modules/warehouse/application/ports/goods-turnover-report/goods-turnover-report.port';

interface Bucket {
    quantity: number;
    // Копейки — см. Money, шапка комментария.
    sumKopecks: number;
}

function addToBucket(
    byCategory: Map<string, Map<string, Bucket>>,
    categoryId: string,
    warehouseId: string,
    quantity: number,
    sumKopecks: number,
): void {
    let byWarehouse = byCategory.get(categoryId);
    if (!byWarehouse) {
        byWarehouse = new Map<string, Bucket>();
        byCategory.set(categoryId, byWarehouse);
    }
    const bucket = byWarehouse.get(warehouseId) ?? {
        quantity: 0,
        sumKopecks: 0,
    };
    bucket.quantity += quantity;
    bucket.sumKopecks += sumKopecks;
    byWarehouse.set(warehouseId, bucket);
}

function readBucket(
    byCategory: Map<string, Map<string, Bucket>>,
    categoryId: string,
    warehouseId: string,
): Bucket {
    return (
        byCategory.get(categoryId)?.get(warehouseId) ?? {
            quantity: 0,
            sumKopecks: 0,
        }
    );
}

// Пересчитывает и полностью заменяет строки отчёта по оборачиваемости для
// периода (см. architecture.md, RebuildGoodsTurnoverReportService).
//
// Источники — только уже засинканные ERP-данные, без обращений к МойСклад:
// — оборот: MoySkladDemandPosition (только товарные позиции, productId !=
//   null) JOIN MoySkladDemand (moment внутри периода, storeId != null) JOIN
//   MoySkladProduct.folderId — сумма позиции (`sum`) хранится в рублях (см.
//   moysklad-sync.service.ts: MoneySchema уже перевёл её из копеек МойСклад
//   в рубли на входе, затем Math.round), а не копейках — переводится в
//   копейки на границе агрегации (см. Money, шапка комментария). НЕ
//   учитывает RetailDemand/CommissionReportIn (их синка вообще нет в
//   проекте, см. design.md Non-Goals) и не делает отдельного вычета
//   возвратов (в модели MoySkladDemand их нет как отдельного признака).
// — остаток: последний по времени снимок MoySkladStock, чей snapshotAt не
//   превышает конец периода (design.md D6/D9) — для текущего открытого
//   месяца это просто самый свежий снимок, для прошлого — снимок на его
//   конец (включая забэкфилленные месячные снимки, D5.1). MoySkladStock
//   сознательно без Prisma-relation на MoySkladProduct (см. схему) —
//   folderId довосстанавливается отдельным запросом к MoySkladProduct.
//
// Рулап по дереву категорий переиспользует ProductFolderTreeService
// (architecture.md): для каждой категории справочника (включая вложенные
// любого уровня) resolveDescendantFolderIds() даёt id самой категории и
// всех её потомков — сумма их "собственных" (не рулапнутых) бакетов по
// складу и есть итоговая строка отчёта для этой категории и склада.
// Категория без единого движения/остатка всё равно попадает в результат —
// с нулями по всем известным складам (набор складов — объединение складов,
// встретившихся хоть в одном обороте или снимке остатка за этот период; для
// склада, вообще не встретившегося ни в одном источнике, строка не
// заводится — заводить её с гарантированными нулями для склада, о
// существовании которого в этом периоде ничего не известно, было бы
// произвольным допущением).
// implements design.md D4/D6/D9 of shop-turnover-report
@Injectable()
export class RebuildGoodsTurnoverReportService {
    constructor(
        private readonly db: DatabaseService,
        private readonly folderTree: ProductFolderTreeService,
        @Inject(GOODS_TURNOVER_REPORT_REPOSITORY)
        private readonly repository: GoodsTurnoverReportRepositoryPort,
    ) {}

    async rebuild(period: Period): Promise<void> {
        const { to: periodEnd } = period.getBounds();

        const [turnoverByCategory, stockByCategory, folders] =
            await Promise.all([
                this.aggregateTurnover(period),
                this.aggregateStock(periodEnd),
                this.db.moySkladProductFolder.findMany({
                    select: { id: true },
                }),
            ]);

        const warehouseIds = new Set<string>();
        for (const byWarehouse of turnoverByCategory.values()) {
            for (const warehouseId of byWarehouse.keys()) {
                warehouseIds.add(warehouseId);
            }
        }
        for (const byWarehouse of stockByCategory.values()) {
            for (const warehouseId of byWarehouse.keys()) {
                warehouseIds.add(warehouseId);
            }
        }

        const lines: GoodsTurnoverReportLine[] = [];
        for (const folder of folders) {
            const descendantIds =
                await this.folderTree.resolveDescendantFolderIds(folder.id);

            for (const warehouseId of warehouseIds) {
                let turnoverQuantity = 0;
                let turnoverSumKopecks = 0;
                let stockQuantity = 0;
                let stockSumKopecks = 0;

                for (const descendantId of descendantIds) {
                    const turnover = readBucket(
                        turnoverByCategory,
                        descendantId,
                        warehouseId,
                    );
                    turnoverQuantity += turnover.quantity;
                    turnoverSumKopecks += turnover.sumKopecks;

                    const stock = readBucket(
                        stockByCategory,
                        descendantId,
                        warehouseId,
                    );
                    stockQuantity += stock.quantity;
                    stockSumKopecks += stock.sumKopecks;
                }

                lines.push(
                    GoodsTurnoverReportLine.create({
                        period,
                        categoryId: folder.id,
                        warehouseId,
                        turnoverQuantity,
                        turnoverSum: Money.ofKopecks(turnoverSumKopecks),
                        stockQuantity,
                        stockSum: Money.ofKopecks(stockSumKopecks),
                    }),
                );
            }
        }

        await this.repository.replaceForPeriod(period, lines);
    }

    private async aggregateTurnover(
        period: Period,
    ): Promise<Map<string, Map<string, Bucket>>> {
        const { from, to } = period.getBounds();

        const positions = await this.db.moySkladDemandPosition.findMany({
            where: {
                productId: { not: null },
                demand: {
                    moment: { gte: from, lte: to },
                    storeId: { not: null },
                },
            },
            select: {
                quantity: true,
                sum: true,
                product: { select: { folderId: true } },
                demand: { select: { storeId: true } },
            },
        });

        const byCategory = new Map<string, Map<string, Bucket>>();
        for (const position of positions) {
            const folderId = position.product?.folderId;
            const warehouseId = position.demand.storeId;
            if (!folderId || !warehouseId) continue;

            // Рубли -> копейки (см. WHY в шапке файла).
            addToBucket(
                byCategory,
                folderId,
                warehouseId,
                position.quantity,
                position.sum * 100,
            );
        }
        return byCategory;
    }

    private async aggregateStock(
        periodEnd: Date,
    ): Promise<Map<string, Map<string, Bucket>>> {
        const latest = await this.db.moySkladStock.aggregate({
            _max: { snapshotAt: true },
            where: { snapshotAt: { lte: periodEnd } },
        });
        const snapshotAt = latest._max.snapshotAt;

        const byCategory = new Map<string, Map<string, Bucket>>();
        if (!snapshotAt) {
            return byCategory;
        }

        const stockRows = await this.db.moySkladStock.findMany({
            where: { snapshotAt },
            select: {
                productId: true,
                warehouseId: true,
                quantity: true,
                costSum: true,
            },
        });
        if (stockRows.length === 0) {
            return byCategory;
        }

        const productIds = [...new Set(stockRows.map((row) => row.productId))];
        const products = await this.db.moySkladProduct.findMany({
            where: { id: { in: productIds } },
            select: { id: true, folderId: true },
        });
        const folderByProductId = new Map(
            products.map((product) => [product.id, product.folderId]),
        );

        for (const row of stockRows) {
            const folderId = folderByProductId.get(row.productId);
            if (!folderId) continue;

            addToBucket(
                byCategory,
                folderId,
                row.warehouseId,
                row.quantity,
                row.costSum,
            );
        }
        return byCategory;
    }
}
