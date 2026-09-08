import { Body, Controller, Param, Patch } from '@nestjs/common';
import { CommandBus } from '@nestjs/cqrs';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import type { EmployeeIdentityResponse } from 'ireports-contracts';
import { routesV1 } from '@/config/app.routes';
import { EmployeeIdentityUpdateDto } from '../dto/employee-identity-update.dto';
import { UpdateEmployeeIdentityCommand } from '../../application/command/update-employee-identity.command';

// Гард снят по решению пользователя — см. пояснение в
// create-employee-identity.http.controller.ts.
// import { PortalAdminGuard } from '@/integrations/bitrix/auth/portal-admin.guard';

// @UseGuards(PortalAdminGuard)
@ApiTags('Идентификация сотрудников')
@Controller(routesV1.version)
export class UpdateEmployeeIdentityHttpController {
    constructor(private readonly commandBus: CommandBus) {}

    @Patch(routesV1.employeeIdentity.byId)
    @ApiOperation({
        summary: 'Изменить тип идентификатора и/или внешний ID связи',
    })
    async update(
        @Param('id') id: string,
        @Body() body: EmployeeIdentityUpdateDto,
    ): Promise<EmployeeIdentityResponse> {
        const command = new UpdateEmployeeIdentityCommand({
            identityId: id,
            ...body,
        });
        return this.commandBus.execute(command);
    }
}
