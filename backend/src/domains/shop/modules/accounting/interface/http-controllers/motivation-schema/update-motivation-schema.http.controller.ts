import { Body, Controller, Param, Patch, UseGuards } from '@nestjs/common';
import { SessionAuthGuard } from '@/modules/session/interface/session-auth.guard';
import { CsrfGuard } from '@/modules/session/interface/csrf.guard';
import { PermissionsGuard } from '@/modules/roles/interface/permissions.guard';
import { RequirePermissions } from '@/shared/decorators/require-permissions.decorator';
import { routesV1 } from '@/config/app.routes';
import { CommandBus } from '@nestjs/cqrs';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { UpdateShopMotivationSchemaDto } from '../../dto/motivation-schema/update-motivation-schema.dto';
import { ShopMotivationResponse } from 'ireports-contracts';
import { UpdateShopMotivationSchemaCommand } from '@/domains/shop/modules/accounting/application/command/motivation-schema/update-motivation-schema.command';

// PATCH /v1/shop/accounting/motivation-schema/:id (Фаза "Редактирование
// зарплатных схем", issue #57) — зеркало
// UpdateMotivationSchemaHttpController сервиса, свой namespace
// routesV1.shop.accounting (см. app.routes.ts). Переименование + полная
// замена набора правил направления shop — POST-создание (find-or-create)
// этим эндпоинтом не затрагивается.
@ApiTags('Бухгалтерия: мотивационная схема')
@UseGuards(SessionAuthGuard, CsrfGuard, PermissionsGuard)
@RequirePermissions('shop-accounting:manage_schema')
@Controller()
export class UpdateShopMotivationSchemaHttpController {
    constructor(private readonly commandBus: CommandBus) {}

    @Patch(routesV1.shop.accounting.motivationSchema.byId)
    @ApiOperation({
        summary:
            'Переименовать мотивационную схему магазина и заменить набор её правил',
    })
    async update(
        @Param('id') id: string,
        @Body() body: UpdateShopMotivationSchemaDto,
    ): Promise<ShopMotivationResponse> {
        const command = new UpdateShopMotivationSchemaCommand({
            motivationSchemaId: id,
            name: body.name,
            rules: body.rules,
        });
        return await this.commandBus.execute(command);
    }
}
