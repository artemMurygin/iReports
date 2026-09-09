import { ArgumentInvalidException } from '@/shared/exceptions';
import { withRequestContext } from '@/shared/testing/with-request-context';
import { GoodsTurnoverWarehouseScope } from './goods-turnover-warehouse-scope.value-object';

describe('GoodsTurnoverWarehouseScope', () => {
    // spec: service/goods-turnover#requirement-глубина-категорий-в-отчёте-ограничивается-по-складу
    it('default() — основной склад 38107, глубина 1, остальные — глубина 0', () => {
        const scope = GoodsTurnoverWarehouseScope.default();

        expect(scope.maxCategoryDepthFor(38107)).toBe(1);
        expect(scope.maxCategoryDepthFor(1)).toBe(0);
        expect(scope.maxCategoryDepthFor(999999)).toBe(0);
    });

    it('unrestricted() — глубина не ограничена ни для какого склада', () => {
        const scope = GoodsTurnoverWarehouseScope.unrestricted();

        expect(scope.maxCategoryDepthFor(1)).toBe(Number.POSITIVE_INFINITY);
        expect(scope.maxCategoryDepthFor(999999)).toBe(
            Number.POSITIVE_INFINITY,
        );
    });

    it('create() кидает на неположительном/нецелом mainWarehouseId', () => {
        withRequestContext(() => {
            expect(() =>
                GoodsTurnoverWarehouseScope.create({
                    mainWarehouseId: 0,
                    mainWarehouseCategoryDepth: 1,
                    defaultCategoryDepth: 0,
                }),
            ).toThrow(ArgumentInvalidException);
            expect(() =>
                GoodsTurnoverWarehouseScope.create({
                    mainWarehouseId: 1.5,
                    mainWarehouseCategoryDepth: 1,
                    defaultCategoryDepth: 0,
                }),
            ).toThrow(ArgumentInvalidException);
        });
    });

    it('create() кидает на отрицательной глубине', () => {
        withRequestContext(() => {
            expect(() =>
                GoodsTurnoverWarehouseScope.create({
                    mainWarehouseId: 1,
                    mainWarehouseCategoryDepth: -1,
                    defaultCategoryDepth: 0,
                }),
            ).toThrow(ArgumentInvalidException);
            expect(() =>
                GoodsTurnoverWarehouseScope.create({
                    mainWarehouseId: 1,
                    mainWarehouseCategoryDepth: 1,
                    defaultCategoryDepth: -1,
                }),
            ).toThrow(ArgumentInvalidException);
        });
    });

    it('create() кидает, когда основной склад охвачен уже, чем остальные', () => {
        withRequestContext(() => {
            expect(() =>
                GoodsTurnoverWarehouseScope.create({
                    mainWarehouseId: 1,
                    mainWarehouseCategoryDepth: 0,
                    defaultCategoryDepth: 1,
                }),
            ).toThrow(ArgumentInvalidException);
        });
    });
});
