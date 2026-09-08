import { Controller, Get } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import type { ShopStoresResponse } from 'ireports-contracts';
import { routesV1 } from '@/config/app.routes';
import { GetShopStoresService } from '../../application/services/get-stores.service';

// GET /v1/shop/warehouse/stores (change shop-turnover-report, design.md
// D10) — справочный список складов МойСклад для построения UI (фильтр
// склада на странице отчёта по оборачиваемости), по аналогии с уже
// существующим GET /shop/warehouse/catalog для дерева категорий.
@ApiTags('Магазин: склад')
@Controller()
export class GetShopStoresHttpController {
    constructor(private readonly getShopStores: GetShopStoresService) {}

    @Get(routesV1.shop.warehouse.stores)
    @ApiOperation({ summary: 'Список складов магазина' })
    async get(): Promise<ShopStoresResponse> {
        return this.getShopStores.list();
    }
}
