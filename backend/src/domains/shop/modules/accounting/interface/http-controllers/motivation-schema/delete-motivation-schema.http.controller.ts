import {
    Controller,
    Delete,
    HttpCode,
    HttpStatus,
    Param,
} from '@nestjs/common';
import { routesV1 } from '@/config/app.routes';
import { CommandBus } from '@nestjs/cqrs';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { DeleteShopMotivationSchemaCommand } from '@/domains/shop/modules/accounting/application/command/motivation-schema/delete-motivation-schema.command';

// DELETE /v1/shop/accounting/motivation-schema/:id — зеркало
// DeleteMotivationSchemaHttpController сервиса, свой namespace
// routesV1.shop.accounting (см. app.routes.ts). Implements FR2 of
// delete-motivation-schema.
@ApiTags('Бухгалтерия: мотивационная схема')
@Controller()
export class DeleteShopMotivationSchemaHttpController {
    constructor(private readonly commandBus: CommandBus) {}

    @Delete(routesV1.shop.accounting.motivationSchema.byId)
    @HttpCode(HttpStatus.NO_CONTENT)
    @ApiOperation({ summary: 'Удалить мотивационную схему магазина целиком' })
    async delete(@Param('id') id: string): Promise<void> {
        const command = new DeleteShopMotivationSchemaCommand({
            schemaId: id,
        });
        await this.commandBus.execute(command);
    }
}
