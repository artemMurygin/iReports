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
import { CommandBus } from '@nestjs/cqrs';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { routesV1 } from '@/config/app.routes';
import { DeleteMotivationSchemaCommand } from '@/domains/service/modules/accounting/application/command/motivation-schema/delete-motivation-schema.command';

// Implements FR1 of delete-motivation-schema.
@ApiTags('Бухгалтерия: мотивационная схема')
@UseGuards(SessionAuthGuard, CsrfGuard, PermissionsGuard)
@RequirePermissions('service-accounting:manage_schema')
@Controller()
export class DeleteMotivationSchemaHttpController {
    constructor(private readonly commandBus: CommandBus) {}

    @Delete(routesV1.service.motivationSchema.byId)
    @HttpCode(HttpStatus.NO_CONTENT)
    @ApiOperation({ summary: 'Удалить мотивационную схему целиком' })
    async delete(@Param('id') id: string): Promise<void> {
        const command = new DeleteMotivationSchemaCommand({ schemaId: id });
        await this.commandBus.execute(command);
    }
}
