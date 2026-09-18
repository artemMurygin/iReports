import { Body, Controller, Param, Patch, UseGuards } from '@nestjs/common';
import { SessionAuthGuard } from '@/modules/session/interface/session-auth.guard';
import { CsrfGuard } from '@/modules/session/interface/csrf.guard';
import { PermissionsGuard } from '@/modules/roles/interface/permissions.guard';
import { RequirePermissions } from '@/shared/decorators/require-permissions.decorator';
import { CommandBus } from '@nestjs/cqrs';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import type { MotivationResponse } from 'ireports-contracts';
import { routesV1 } from '@/config/app.routes';
import { UpdateMotivationSchemaDto } from '../../dto/motivation-schema/update-motivation-schema.dto';
import { UpdateMotivationSchemaCommand } from '@/domains/service/modules/accounting/application/command/motivation-schema/update-motivation-schema.command';

@ApiTags('Бухгалтерия: мотивационная схема')
@UseGuards(SessionAuthGuard, CsrfGuard, PermissionsGuard)
@RequirePermissions('service-accounting:manage_schema')
@Controller()
export class UpdateMotivationSchemaHttpController {
    constructor(private readonly commandBus: CommandBus) {}

    @Patch(routesV1.service.motivationSchema.byId)
    @ApiOperation({
        summary:
            'Переименовать мотивационную схему и заменить набор её правил направления сервис',
    })
    async update(
        @Param('id') id: string,
        @Body() body: UpdateMotivationSchemaDto,
    ): Promise<MotivationResponse> {
        const command = new UpdateMotivationSchemaCommand({
            motivationSchemaId: id,
            name: body.name,
            rules: body.rules,
        });
        return await this.commandBus.execute(command);
    }
}
