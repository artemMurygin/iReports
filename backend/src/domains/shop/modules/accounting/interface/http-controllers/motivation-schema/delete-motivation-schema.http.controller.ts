import {
    Controller,
    Delete,
    HttpCode,
    HttpStatus,
    Param,
    UseGuards,
} from '@nestjs/common';
import { SessionAuthGuard } from '@/modules/session/interface/session-auth.guard';
import { CsrfGuard } from '@/modules/session/interface/csrf.guard';
import { PermissionsGuard } from '@/modules/roles/interface/permissions.guard';
import { RequirePermissions } from '@/shared/decorators/require-permissions.decorator';
import { routesV1 } from '@/config/app.routes';
import { CommandBus } from '@nestjs/cqrs';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { DeleteShopMotivationSchemaCommand } from '@/domains/shop/modules/accounting/application/command/motivation-schema/delete-motivation-schema.command';

// DELETE /v1/shop/accounting/motivation-schema/:id — зеркало
// DeleteMotivationSchemaHttpController сервиса, свой namespace
// routesV1.shop.accounting (см. app.routes.ts). Implements FR2 of
// delete-motivation-schema.
@ApiTags('Бухгалтерия: мотивационная схема')
@UseGuards(SessionAuthGuard, CsrfGuard, PermissionsGuard)
@RequirePermissions('shop-accounting:manage_schema')
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
