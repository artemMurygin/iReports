import { Controller, Get } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import type { ListProductCategoriesResponse } from 'ireports-contracts';
import { routesV1 } from '@/config/app.routes';
import { ListProductCategoriesService } from '@/domains/service/modules/warehouse/application/services/product-category/list-product-categories.service';

// Справочник категорий товаров (задача 10, design.md D8) — плоский список,
// используется CategoryTreeSelect (задача 17) на фронтенде для построения
// дерева и фильтра отчёта.
@ApiTags('Сервис: склад')
@Controller()
export class ListProductCategoriesHttpController {
    constructor(
        private readonly listProductCategories: ListProductCategoriesService,
    ) {}

    @Get(routesV1.service.warehouse.productCategories)
    @ApiOperation({ summary: 'Список категорий товаров' })
    async get(): Promise<ListProductCategoriesResponse> {
        return this.listProductCategories.execute();
    }
}
