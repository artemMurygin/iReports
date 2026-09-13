import { Injectable } from '@nestjs/common';
import { DatabaseService } from '@/infrustructure/database/database.service';
import type { ProductCategoryRepositoryPort } from '@/domains/shop/modules/warehouse/application/ports/product-category/product-category.port';

// implements FR5 of add-department-head-salary-rules
// Читает MoySkladProductFolder напрямую через глобальный DatabaseService (тот же приём, что уже
// использует GetCatalogService этого же модуля) — единственное, что нужно здесь, это id настоящих
// корневых категорий (parentId IS NULL), не дерево целиком.
@Injectable()
export class ProductCategoryRepository implements ProductCategoryRepositoryPort {
    constructor(private readonly db: DatabaseService) {}

    async findRootIds(): Promise<Set<string>> {
        const roots = await this.db.moySkladProductFolder.findMany({
            where: { parentId: null },
            select: { id: true },
        });
        return new Set(roots.map((root) => root.id));
    }
}
