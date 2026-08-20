import { Controller, Get, Query } from '@nestjs/common';
import { routesV1 } from '@/config/app.routes';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { ListShopMotivationSchemasQueryDto } from '../dto/list-shop-motivation-schemas-query.dto';
import { ListShopMotivationSchemasResponse } from 'ireports-contracts';
import { ListShopMotivationSchemasService } from '@/domains/shop/modules/accounting/application/services/list-shop-motivation-schemas.service';

// GET /v1/shop/accounting/motivation-schema (Фаза "Редактирование
// зарплатных схем", issue #57) — зеркало
// ListMotivationSchemasHttpController сервиса, свой namespace
// routesV1.shop.accounting (см. app.routes.ts).
@ApiTags('Бухгалтерия: мотивационная схема')
@Controller()
export class ListShopMotivationSchemasHttpController {
    constructor(
        private readonly listShopMotivationSchemasService: ListShopMotivationSchemasService,
    ) {}

    @Get(routesV1.shop.accounting.motivationSchema.root)
    @ApiOperation({
        summary:
            'Список мотивационных схем магазина (с фильтрами по цели и поиском по названию)',
    })
    async list(
        @Query() query: ListShopMotivationSchemasQueryDto,
    ): Promise<ListShopMotivationSchemasResponse> {
        return await this.listShopMotivationSchemasService.execute(query);
    }
}
