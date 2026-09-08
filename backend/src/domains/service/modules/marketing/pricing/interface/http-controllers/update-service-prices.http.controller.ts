import { Body, Controller, Post } from '@nestjs/common';
import { CommandBus } from '@nestjs/cqrs';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import type { UpdateServicePricesResponse } from 'ireports-contracts';
import { routesV1 } from '@/config/app.routes';
import { UpdateServicePricesDto } from '../dto/update-service-prices.dto';
import { UpdateServicePricesCommand } from '../../application/command/update-service-prices.command';

// Новый дом сервисной половины POST /price-monitoring/update-service-price
// из src/TODO/priceMonitoring (см. комментарий у serviceMarketingPricingRoot
// в app.routes.ts) — легаси-эндпоинт при этом не трогается и продолжает
// работать для shop-половины (update-shop-products-costs), это параллельный
// маршрут на время миграции (Фаза 7,
// docs/todo-modules-ddd-refactoring/plan-todo-modules-ddd-refactoring.md).
@ApiTags('Маркетинг: цены услуг')
@Controller()
export class UpdateServicePricesHttpController {
    constructor(private readonly commandBus: CommandBus) {}

    @Post(routesV1.service.marketing.pricing.updateServicePrices)
    @ApiOperation({
        summary: 'Обновить цены и себестоимость услуг в RemOnline',
    })
    async update(
        @Body() body: UpdateServicePricesDto,
    ): Promise<UpdateServicePricesResponse> {
        const command = new UpdateServicePricesCommand({ items: body });
        return this.commandBus.execute(command);
    }
}
