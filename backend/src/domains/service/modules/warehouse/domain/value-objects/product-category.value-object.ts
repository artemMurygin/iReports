import { ValueObject } from '@/shared/domain/value-object.base';

// Категория товаров RoappProductCategory (roapp.prisma) — плоская проекция
// узла дерева категорий для справочника GET /v1/service/warehouse/
// product-categories и для обхода дерева в BuildGoodsTurnoverReportService
// (задача 9). В отличие от ServiceCategory (domains/service/modules/reports)
// — без depth (RoappProductCategory её не хранит), иерархия восстанавливается
// вызывающей стороной по parentId (см. shared/lib/tree.ts на фронтенде и
// аналогичный обход на бэкенде в BuildGoodsTurnoverReportService).
export interface ProductCategoryProps {
    id: number;
    name: string;
    parentId: number | null;
}

export class ProductCategory extends ValueObject<ProductCategoryProps> {
    static create(props: ProductCategoryProps): ProductCategory {
        return new ProductCategory(props);
    }

    getId(): number {
        return this.props.id;
    }

    getName(): string {
        return this.props.name;
    }

    getParentId(): number | null {
        return this.props.parentId;
    }
}
