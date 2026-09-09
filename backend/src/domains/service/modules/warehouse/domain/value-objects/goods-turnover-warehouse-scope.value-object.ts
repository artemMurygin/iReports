import { ValueObject } from '@/shared/domain/value-object.base';
import { ArgumentInvalidException } from '@/shared/exceptions';

export interface GoodsTurnoverWarehouseScopeProps {
    mainWarehouseId: number;
    mainWarehouseCategoryDepth: number;
    defaultCategoryDepth: number;
}

// Конфигурация того, до какой глубины дерева категорий (0 — только корень,
// 1 — корень и прямые дети, и т.д.) строится отчёт по оборачиваемости для
// склада: отдельно для «основного» склада (mainWarehouseId) и для всех
// остальных (spec: service/goods-turnover#requirement-глубина-категорий-в-отчёте-ограничивается-по-складу).
// Мотивация — та же, что была за разовым SINGLE_WAREHOUSE_ID/MAX_CATEGORY_DEPTH
// в scripts/recalcGoodsTurnoverOnce.ts: комбинаторика категория × склад
// (design.md, риск "Комбинаторика категория × склад").
export class GoodsTurnoverWarehouseScope extends ValueObject<GoodsTurnoverWarehouseScopeProps> {
    static create(
        props: GoodsTurnoverWarehouseScopeProps,
    ): GoodsTurnoverWarehouseScope {
        if (
            !Number.isInteger(props.mainWarehouseId) ||
            props.mainWarehouseId <= 0
        ) {
            throw new ArgumentInvalidException(
                `mainWarehouseId должен быть целым положительным числом, получено: ${props.mainWarehouseId}`,
            );
        }
        if (props.mainWarehouseCategoryDepth < 0) {
            throw new ArgumentInvalidException(
                `mainWarehouseCategoryDepth не может быть отрицательным, получено: ${props.mainWarehouseCategoryDepth}`,
            );
        }
        if (props.defaultCategoryDepth < 0) {
            throw new ArgumentInvalidException(
                `defaultCategoryDepth не может быть отрицательным, получено: ${props.defaultCategoryDepth}`,
            );
        }
        if (props.mainWarehouseCategoryDepth < props.defaultCategoryDepth) {
            throw new ArgumentInvalidException(
                `mainWarehouseCategoryDepth (${props.mainWarehouseCategoryDepth}) не может быть меньше defaultCategoryDepth (${props.defaultCategoryDepth}) — основной склад не может быть охвачен уже, чем остальные`,
            );
        }
        return new GoodsTurnoverWarehouseScope(props);
    }

    // Канонический экземпляр для прода: единственное место, где id основного
    // склада и глубины заданы буквально (перенесено из disposable
    // scripts/recalcGoodsTurnoverOnce.ts).
    static default(): GoodsTurnoverWarehouseScope {
        return GoodsTurnoverWarehouseScope.create({
            mainWarehouseId: 38107, // "1 iRepair | Основной"
            mainWarehouseCategoryDepth: 1,
            defaultCategoryDepth: 0,
        });
    }

    // Без ограничения глубины — для тестов, которым сам факт ограничения не
    // важен (не привязывает их к прод-id основного склада).
    static unrestricted(): GoodsTurnoverWarehouseScope {
        return GoodsTurnoverWarehouseScope.create({
            mainWarehouseId: 1,
            mainWarehouseCategoryDepth: Number.POSITIVE_INFINITY,
            defaultCategoryDepth: Number.POSITIVE_INFINITY,
        });
    }

    maxCategoryDepthFor(warehouseId: number): number {
        return warehouseId === this.props.mainWarehouseId
            ? this.props.mainWarehouseCategoryDepth
            : this.props.defaultCategoryDepth;
    }
}
