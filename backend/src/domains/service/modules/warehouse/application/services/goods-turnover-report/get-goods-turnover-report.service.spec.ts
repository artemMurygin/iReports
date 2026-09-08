import { GetGoodsTurnoverReportService } from './get-goods-turnover-report.service';
import type { GoodsTurnoverReportLineRepositoryPort } from '../../ports/goods-turnover-report/goods-turnover-report-line.port';
import type { ProductCategoryRepositoryPort } from '../../ports/product-category/product-category.port';
import type { WarehouseRepositoryPort } from '../../ports/warehouse/warehouse.port';
import { GoodsTurnoverReportLine } from '../../../domain/entities/goods-turnover-report/goods-turnover-report-line.entity';
import { GoodsFlowMetric } from '../../../domain/value-objects/goods-flow-metric.value-object';
import { ProductCategory } from '../../../domain/value-objects/product-category.value-object';
import { Warehouse } from '../../../domain/value-objects/warehouse.value-object';

// TDD задачи 10.1-10.4 (openspec/changes/service-turnover-report/tasks.md,
// "Application/Interface: чтение отчёта и справочников") — по образцу
// list-order-types.service.spec.ts (modules/reports): моки портов через
// jest.fn(), без реальной БД.
describe('GetGoodsTurnoverReportService', () => {
    const buildService = (
        lines: GoodsTurnoverReportLine[],
        categories: ProductCategory[] = [],
        warehouses: Warehouse[] = [],
    ) => {
        const findByPeriod = jest
            .fn<Promise<GoodsTurnoverReportLine[]>, [string]>()
            .mockResolvedValue(lines);
        const lineRepo: GoodsTurnoverReportLineRepositoryPort = {
            findByPeriod,
            replaceAll: jest.fn(),
        };
        const findAllCategories = jest
            .fn<Promise<ProductCategory[]>, []>()
            .mockResolvedValue(categories);
        const categoryRepo: ProductCategoryRepositoryPort = {
            findAll: findAllCategories,
        };
        const findAllWarehouses = jest
            .fn<Promise<Warehouse[]>, []>()
            .mockResolvedValue(warehouses);
        const warehouseRepo: WarehouseRepositoryPort = {
            findAll: findAllWarehouses,
        };

        return {
            service: new GetGoodsTurnoverReportService(
                lineRepo,
                categoryRepo,
                warehouseRepo,
            ),
            findByPeriod,
            findAllCategories,
            findAllWarehouses,
        };
    };

    it('период без сохранённых строк — пустой список, не ошибка', async () => {
        const { service, findAllCategories, findAllWarehouses } =
            buildService([]);

        const result = await service.get('2026-01');

        expect(result).toEqual({ period: '2026-01', lines: [] });
        // Справочники не нужны, если строк нет — нечего денормализовать.
        expect(findAllCategories).not.toHaveBeenCalled();
        expect(findAllWarehouses).not.toHaveBeenCalled();
    });

    it('строки периода + справочники категорий/складов → форма ответа', async () => {
        const line = GoodsTurnoverReportLine.create({
            period: '2026-01',
            categoryId: 10,
            warehouseId: 1,
            outcome: GoodsFlowMetric.create(5, 5000),
            stock: GoodsFlowMetric.create(2, 2000),
        });
        line.calcRatio(3000);
        const { service } = buildService(
            [line],
            [
                ProductCategory.create({
                    id: 10,
                    name: 'Аккумуляторы',
                    parentId: 1,
                }),
            ],
            [Warehouse.create({ id: 1, name: 'Основной склад' })],
        );

        const result = await service.get('2026-01');

        expect(result).toEqual({
            period: '2026-01',
            lines: [
                {
                    categoryId: 10,
                    categoryName: 'Аккумуляторы',
                    categoryParentId: 1,
                    warehouseId: 1,
                    warehouseName: 'Основной склад',
                    outcomeQuantity: 5,
                    outcomeSum: 5000,
                    stockQuantity: 2,
                    stockSum: 2000,
                    // outcome.sum / ((3000 + 2000) / 2) = 5000 / 2500 = 2
                    turnoverRatio: 2,
                },
            ],
        });
    });

    it('строка ссылается на категорию/склад, отсутствующие в справочнике — денормализуется пустой строкой, не падает', async () => {
        const line = GoodsTurnoverReportLine.create({
            period: '2026-01',
            categoryId: 999,
            warehouseId: 999,
            outcome: GoodsFlowMetric.zero(),
            stock: GoodsFlowMetric.zero(),
        });
        const { service } = buildService([line], [], []);

        const result = await service.get('2026-01');

        expect(result.lines[0]).toMatchObject({
            categoryId: 999,
            categoryName: '',
            categoryParentId: null,
            warehouseId: 999,
            warehouseName: '',
        });
    });
});
