import { Body, Controller, Post } from '@nestjs/common';
import { routesV1 } from '@/config/app.routes';
import { CommandBus } from '@nestjs/cqrs';
import { ShopMotivationSchemaCreateDto } from '../dto/shop-motivation-schema-create.dto';
import { ShopMotivationResponse } from 'ireports-contracts';
import { CreateShopMotivationSchemaCommand } from '@/domains/shop/modules/accounting/application/command/create-shop-motivation-schema.command';

// POST /shop/accounting/motivation-schema (Фаза 13.5, issue #57) — зеркало
// CreateMotivationSchemaHttpController сервиса, свой namespace
// routesV1.shopAccounting (см. app.routes.ts).
@Controller()
export class CreateShopMotivationSchemaHttpController {
    constructor(private readonly commandBus: CommandBus) {}

    @Post(routesV1.shopAccounting.motivationSchema)
    async create(
        @Body() body: ShopMotivationSchemaCreateDto,
    ): Promise<ShopMotivationResponse> {
        const command = new CreateShopMotivationSchemaCommand(body);
        return await this.commandBus.execute(command);
    }
}
