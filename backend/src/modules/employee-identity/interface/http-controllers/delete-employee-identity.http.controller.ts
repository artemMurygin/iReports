import {
    Controller,
    Delete,
    HttpCode,
    HttpStatus,
    Param,
    UseGuards,
} from '@nestjs/common';
import { CommandBus } from '@nestjs/cqrs';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { routesV1 } from '@/config/app.routes';
import { PortalAdminGuard } from '@/integrations/bitrix/auth/portal-admin.guard';
import { DeleteEmployeeIdentityCommand } from '../../application/command/delete-employee-identity.command';

@UseGuards(PortalAdminGuard)
@ApiTags('Идентификация сотрудников')
@Controller(routesV1.version)
export class DeleteEmployeeIdentityHttpController {
    constructor(private readonly commandBus: CommandBus) {}

    @Delete(routesV1.employeeIdentity.byId)
    @HttpCode(HttpStatus.NO_CONTENT)
    @ApiOperation({ summary: 'Удалить связь сотрудника с внешней системой' })
    async delete(@Param('id') id: string): Promise<void> {
        const command = new DeleteEmployeeIdentityCommand({ identityId: id });
        await this.commandBus.execute(command);
    }
}
