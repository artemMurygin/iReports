import { Controller, Get, Param, UseGuards } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import type { EmployeeIdentityResponse } from 'ireports-contracts';
import { routesV1 } from '@/config/app.routes';
import { ArgumentInvalidException } from '@/shared/exceptions';
import { PortalAdminGuard } from '@/integrations/bitrix/auth/portal-admin.guard';
import { ListEmployeeIdentitiesService } from '../../application/services/list-employee-identities.service';

@UseGuards(PortalAdminGuard)
@ApiTags('Идентификация сотрудников')
@Controller(routesV1.version)
export class ListEmployeeIdentitiesHttpController {
    constructor(
        private readonly listEmployeeIdentities: ListEmployeeIdentitiesService,
    ) {}

    @Get(routesV1.employeeIdentity.byEmployee)
    @ApiOperation({
        summary: 'Связи конкретного сотрудника с внешними системами',
    })
    async list(
        @Param('employeeId') employeeId: string,
    ): Promise<EmployeeIdentityResponse[]> {
        const id = Number(employeeId);
        if (!Number.isInteger(id)) {
            throw new ArgumentInvalidException(
                `id сотрудника должен быть числом, получено: "${employeeId}"`,
            );
        }

        return this.listEmployeeIdentities.execute(id);
    }
}
