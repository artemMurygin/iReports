import { Inject, Injectable } from '@nestjs/common';
import type { ListWarehousesResponse } from 'ireports-contracts';
import { WAREHOUSE_REPOSITORY } from '@/domains/service/modules/warehouse/application/ports/warehouse/warehouse.port';
import type { WarehouseRepositoryPort } from '@/domains/service/modules/warehouse/application/ports/warehouse/warehouse.port';
import { toWarehouseResponse } from '@/domains/service/modules/warehouse/application/mappers/warehouse/to-warehouse-response';

// Read-side справочника складов (GET /v1/service/warehouse/warehouses,
// задача 10) — резервный справочник ROAPP_WAREHOUSES (design.md D3),
// синкающийся в roapp_warehouses. По образцу ListOrderTypesService
// (modules/reports)/ListProductCategoriesService выше.
@Injectable()
export class ListWarehousesService {
    constructor(
        @Inject(WAREHOUSE_REPOSITORY)
        private readonly repo: WarehouseRepositoryPort,
    ) {}

    async execute(): Promise<ListWarehousesResponse> {
        const warehouses = await this.repo.findAll();
        return warehouses.map(toWarehouseResponse);
    }
}
