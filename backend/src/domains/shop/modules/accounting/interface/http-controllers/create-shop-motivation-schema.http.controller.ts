import { Body, Controller, Post } from '@nestjs/common';
import { routesV1 } from '@/config/app.routes';
import { CommandBus } from '@nestjs/cqrs';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { ShopMotivationSchemaCreateDto } from '../dto/shop-motivation-schema-create.dto';
import { ShopMotivationResponse } from 'ireports-contracts';
import { CreateShopMotivationSchemaCommand } from '@/domains/shop/modules/accounting/application/command/create-shop-motivation-schema.command';

// POST /shop/accounting/motivation-schema (Фаза 13.5, issue #57) — зеркало
// CreateMotivationSchemaHttpController сервиса, свой namespace
// routesV1.shop.accounting (см. app.routes.ts).
@ApiTags('Бухгалтерия: мотивационная схема')
@Controller()
export class CreateShopMotivationSchemaHttpController {
    constructor(private readonly commandBus: CommandBus) {}

    @Post(routesV1.shop.accounting.motivationSchema.root)
    @ApiOperation({
        summary: 'Создать мотивационную схему сотрудника или отдела магазина',
    })
    async create(
        @Body() body: ShopMotivationSchemaCreateDto,
    ): Promise<ShopMotivationResponse> {
        const command = new CreateShopMotivationSchemaCommand(body);
        return await this.commandBus.execute(command);
    }
}
