import {
    Controller,
    Delete,
    HttpCode,
    HttpStatus,
    Param,
} from '@nestjs/common';
import { CommandBus } from '@nestjs/cqrs';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { routesV1 } from '@/config/app.routes';
import { DeleteEmployeeIdentityCommand } from '../../application/command/delete-employee-identity.command';

// Гард снят по решению пользователя — см. пояснение в
// create-employee-identity.http.controller.ts.
// import { PortalAdminGuard } from '@/integrations/bitrix/auth/portal-admin.guard';

// @UseGuards(PortalAdminGuard)
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
