import { Controller, Get } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import type { CatalogCategoryResponse } from 'ireports-contracts';
import { routesV1 } from '@/config/app.routes';
import { GetCatalogService } from '../../application/services/get-catalog.service';
import { toCatalogResponse } from '../../application/mappers/to-catalog-response';

// GET /shop/warehouse/catalog (Фаза 1, см.
// docs/shop-warehouse-catalog/plan-shop-warehouse-catalog.md) — без
// гарда, по тому же принципу, что и остальные внутренние эндпоинты
// domains/shop (accounting/sales).
@ApiTags('Склад: каталог')
@Controller()
export class GetCatalogHttpController {
    constructor(private readonly getCatalog: GetCatalogService) {}

    @Get(routesV1.shop.warehouse.catalog)
    @ApiOperation({ summary: 'Дерево категорий каталога магазина' })
    async get(): Promise<CatalogCategoryResponse[]> {
        const tree = await this.getCatalog.getTree();
        return toCatalogResponse(tree);
    }
}
