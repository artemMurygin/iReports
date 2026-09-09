import { Controller, Get } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import type { ListWarehousesResponse } from 'ireports-contracts';
import { routesV1 } from '@/config/app.routes';
import { ListWarehousesService } from '@/domains/service/modules/warehouse/application/services/warehouse/list-warehouses.service';

// Справочник складов (задача 10, design.md D8) — резервный справочник
// ROAPP_WAREHOUSES (design.md D3), используется WarehouseSelect
// (задача 16) на фронтенде для переключения склада отчёта.
@ApiTags('Сервис: склад')
@Controller()
export class ListWarehousesHttpController {
    constructor(private readonly listWarehouses: ListWarehousesService) {}

    @Get(routesV1.service.warehouse.warehouses)
    @ApiOperation({ summary: 'Список складов' })
    async get(): Promise<ListWarehousesResponse> {
        return this.listWarehouses.execute();
    }
}
