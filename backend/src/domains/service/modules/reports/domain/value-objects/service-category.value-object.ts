import { ValueObject } from '@/shared/domain/value-object.base';

// Категория услуг RoappServiceCategory (roapp.prisma) — плоская проекция для
// GET /v1/service/reports/service-categories (Фаза 5), перенос
// ReportsService.getServiceCategories (src/TODO/reports/reports.service.ts).
// В отличие от CategoryNode каталога магазина (domains/shop/modules/
// warehouse) — не дерево, а плоский список, той же формы, что и легаси-ответ.
// spec: service/reports#requirement-справочник-категорий-услуг-плоский-список-с-указателем-на-родителя
export interface ServiceCategoryProps {
    id: number;
    name: string;
    parentId: number | null;
    depth: number;
}

export class ServiceCategory extends ValueObject<ServiceCategoryProps> {
    static create(props: ServiceCategoryProps): ServiceCategory {
        return new ServiceCategory(props);
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

    getDepth(): number {
        return this.props.depth;
    }
}
