import { Injectable } from '@nestjs/common';
import { DatabaseService } from '@/infrustructure/database/database.service';
import { PrismaRepository } from '@/shared/infrastructure/persistence/prisma.repository';
import { ProductCategoryRepositoryPort } from '@/domains/service/modules/warehouse/application/ports/product-category/product-category.port';
import { ProductCategory } from '@/domains/service/modules/warehouse/domain/value-objects/product-category.value-object';

// Read-репозиторий над уже существующей RoappProductCategory
// (см. architecture.md, "ProductCategoryRepository") — без бизнес-
// инвариантов, тем же приёмом, что ServiceSalesRepository.listCategories
// (modules/reports) читает соседнюю RoappServiceCategory.
@Injectable()
export class ProductCategoryRepository
    extends PrismaRepository
    implements ProductCategoryRepositoryPort
{
    constructor(db: DatabaseService) {
        super(db);
    }

    async findAll(): Promise<ProductCategory[]> {
        const rows = await this.client.roappProductCategory.findMany({
            select: { id: true, name: true, parentId: true },
        });

        return rows.map((row) =>
            ProductCategory.create({
                id: row.id,
                name: row.name,
                parentId: row.parentId,
            }),
        );
    }
}
