import { Injectable } from '@nestjs/common';
import { DatabaseService } from '@/infrustructure/database/database.service';
import { PrismaRepository } from '@/shared/infrastructure/persistence/prisma.repository';
import { Period } from '@/shared/domain/period.value-object';
import {
    ShopSalesFactErpAggregate,
    ShopSalesFactSourcePort,
} from '@/domains/shop/modules/sales/application/ports/sales-fact-source.port';
import { ProductFolderTreeService } from '@/domains/shop/sync/moySklad/product-folder-tree.service';

// Решение по открытому вопросу Фазы 11 (частично отходит от зеркала
// решения Фазы 5 для service, см.
// domains/service/modules/sales/infrastructure/repositories/
// roapp-sales-fact-source.repository.ts):
//
// - **Период** фильтруется по MoySkladDemand.moment (дата операции в
//   МойСклад, индексирована — см. moySklad.prisma), а не createdAt —
//   moment это дата, к которой относится сама отгрузка (в отличие от
//   RoappOrder, где "оплаченный и закрытый заказ" определялся полями
//   payed/closedAt, у MoySkladDemand отдельного признака "оплаты" на
//   уровне факта не используется: отгрузка — уже свершившаяся реализация
//   товара, а не заказ в процессе выполнения, поэтому дополнительный
//   фильтр по payedSum не нужен).
// - **Отдел отгрузки** захардкожен как SHOP_DEPARTMENT_ID (в компании пока
//   существует только один отдел магазина, BitrixDepartment.id = 160) —
//   резолвинг через offlineManagerId → MoySkladEmployee → bitrixEmployee →
//   departmentId не нужен, он лишь отфильтровывал позиции с
//   несопоставленным сотрудником, а деления на отделы всё равно нет. Если
//   в компании появится больше одного отдела магазина — вернуть резолвинг
//   через сотрудника (см. историю этого файла) и снова пропускать позиции
//   без сопоставленного отдела.
//   spec: shop/sales#requirement-факт-продаж-агрегируется-по-единственному-отделу-магазина
// - **Маржа** — сумма MoySkladDemandPosition.profit по позициям.
//   spec: shop/sales#requirement-факт-продаж-вычисляется-из-готовой-маржи-мойсклад-а-не-как-оборот-минус-себестоимость
// - **Категория** (Фаза 1, docs/shop-sales-performance-by-category) —
//   раскрывается из переданных categoryIds (корневые category/folderId
//   среди планов периода, см. GetShopSalesPerformanceService.listForPeriod)
//   через ProductFolderTreeService.resolveDescendantFolderIds — тот же
//   приём кросс-модульного переиспользования infrastructure-в-infrastructure
//   внутри домена shop, что уже применён в
//   ShopCalculationDataRepository.resolveCategoryDescendantFolderIds.
//   Категория позиции — folderId её товара либо услуги (у позиции
//   заполнено ровно одно из двух, см.
//   ShopCalculationDataRepository.findProductSoldItems), приведённый к
//   корневой категории через обратный индекс "descendant → root". Позиции,
//   чей folderId не попал ни в одну из запрошенных категорий (в т.ч. когда
//   categoryIds пуст), агрегируются в бакет с category: null — поведение
//   для планов без категории не меняется.
//
// Один запрос на весь период (без N+1 по строкам плана), JS-агрегация —
// тот же приём и то же обоснование производительности, что и у
// RoappSalesFactSourceRepository.
const SHOP_DEPARTMENT_ID = 160;

interface AggregationBucket {
    department: number;
    category: string | null;
    turnover: number;
    margin: number;
    cost: number;
    quantity: number;
}

@Injectable()
export class MoySkladSalesFactSourceRepository
    extends PrismaRepository
    implements ShopSalesFactSourcePort
{
    constructor(
        db: DatabaseService,
        private readonly folderTree: ProductFolderTreeService,
    ) {
        super(db);
    }

    async aggregate(
        period: string,
        categoryIds: string[],
    ): Promise<ShopSalesFactErpAggregate[]> {
        const { from, to } = Period.create(period).getBounds();

        // Обратный индекс "descendant folderId -> root categoryId" —
        // построен один раз перед агрегацией позиций, чтобы каждую позицию
        // классифицировать O(1) вместо повторного обхода дерева на позицию.
        // Если среди categoryIds одновременно встретились родительская и
        // дочерняя категория (планы заведены и на "Электронику", и на
        // вложенные в неё "Смартфоны"), обрабатываем категории от самой
        // специфичной к самой общей (по возрастанию размера множества
        // потомков) и не перезаписываем уже выставленную запись — так
        // позиция внутри "Смартфонов" всегда попадёт именно в "Смартфоны",
        // а не в "Электронику", независимо от порядка categoryIds.
        const descendantToRoot = new Map<string, string>();
        const uniqueCategoryIds = [...new Set(categoryIds)];
        if (uniqueCategoryIds.length > 0) {
            const descendantsByRoot = await Promise.all(
                uniqueCategoryIds.map(
                    async (rootId) =>
                        [
                            rootId,
                            await this.folderTree.resolveDescendantFolderIds(
                                rootId,
                            ),
                        ] as const,
                ),
            );
            descendantsByRoot.sort(([, a], [, b]) => a.length - b.length);
            for (const [rootId, descendantIds] of descendantsByRoot) {
                for (const descendantId of descendantIds) {
                    if (!descendantToRoot.has(descendantId)) {
                        descendantToRoot.set(descendantId, rootId);
                    }
                }
            }
        }

        const positions = await this.client.moySkladDemandPosition.findMany({
            where: {
                demand: {
                    moment: { gte: from, lte: to },
                },
            },
            select: {
                sum: true,
                cost: true,
                profit: true,
                quantity: true,
                product: { select: { folderId: true } },
                service: { select: { folderId: true } },
            },
        });

        const buckets = new Map<string, AggregationBucket>();

        for (const position of positions) {
            const folderId =
                position.product?.folderId ??
                position.service?.folderId ??
                null;
            const rootCategoryId = folderId
                ? (descendantToRoot.get(folderId) ?? null)
                : null;

            const key = `${SHOP_DEPARTMENT_ID}:${rootCategoryId ?? 'null'}`;
            const bucket = buckets.get(key);
            if (bucket) {
                bucket.turnover += position.sum;
                bucket.margin += position.profit;
                bucket.cost += position.cost;
                bucket.quantity += position.quantity;
            } else {
                buckets.set(key, {
                    department: SHOP_DEPARTMENT_ID,
                    category: rootCategoryId,
                    turnover: position.sum,
                    margin: position.profit,
                    cost: position.cost,
                    quantity: position.quantity,
                });
            }
        }

        return [...buckets.values()];
    }
}
