import { Injectable } from '@nestjs/common';
import { DatabaseService } from '@/infrustructure/database/database.service';
import { PrismaRepository } from '@/shared/infrastructure/persistence/prisma.repository';
import { WarehouseRepositoryPort } from '@/domains/service/modules/warehouse/application/ports/warehouse/warehouse.port';
import { Warehouse } from '@/domains/service/modules/warehouse/domain/value-objects/warehouse.value-object';

// Read-репозиторий над новой RoappWarehouse (резервный справочник
// ROAPP_WAREHOUSES, design.md D3, задача 4) — без бизнес-инвариантов, тем же
// приёмом, что ProductCategoryRepository читает RoappProductCategory.
@Injectable()
export class WarehouseRepository
    extends PrismaRepository
    implements WarehouseRepositoryPort
{
    constructor(db: DatabaseService) {
        super(db);
    }

    async findAll(): Promise<Warehouse[]> {
        const rows = await this.client.roappWarehouse.findMany({
            select: { id: true, name: true },
            orderBy: { name: 'asc' },
        });

        return rows.map((row) =>
            Warehouse.create({ id: row.id, name: row.name }),
        );
    }
}
