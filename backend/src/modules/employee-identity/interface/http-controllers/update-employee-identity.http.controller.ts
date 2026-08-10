import { Body, Controller, Param, Patch, UseGuards } from '@nestjs/common';
import { CommandBus } from '@nestjs/cqrs';
import type { EmployeeIdentityResponse } from 'ireports-contracts';
import { routesV1 } from '@/config/app.routes';
import { PortalAdminGuard } from '@/integrations/bitrix/auth/portal-admin.guard';
import { EmployeeIdentityUpdateDto } from '../dto/employee-identity-update.dto';
import { UpdateEmployeeIdentityCommand } from '../../application/command/update-employee-identity.command';

@UseGuards(PortalAdminGuard)
@Controller(routesV1.version)
export class UpdateEmployeeIdentityHttpController {
    constructor(private readonly commandBus: CommandBus) {}

    @Patch(routesV1.employeeIdentity.byId)
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
