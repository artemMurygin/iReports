import { ValueObject } from '@/shared/domain/value-object.base';

export interface CategoryNodeProps {
    id: string;
    name: string;
    pathName: string;
    children: CategoryNode[];
}

// Узел дерева категорий каталога магазина (MoySkladProductFolder, Фаза 10)
// — readonly-проекция для GET /shop/warehouse/catalog (см. PRD
// docs/shop-warehouse-catalog/prd-shop-warehouse-catalog.md). id — id
// категории в МойСклад, а не собственная идентичность этого домена, у узла
// нет своего жизненного цикла здесь (только чтение уже синхронизированной
// таблицы) — поэтому value object, а не aggregate root.
export class CategoryNode extends ValueObject<CategoryNodeProps> {
    static create(props: CategoryNodeProps): CategoryNode {
        return new CategoryNode(props);
    }

    getId(): string {
        return this.props.id;
    }

    getName(): string {
        return this.props.name;
    }

    getPathName(): string {
        return this.props.pathName;
    }

    getChildren(): CategoryNode[] {
        return this.props.children;
    }
}
