import { Controller, Get } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import type { EmployeeIdentityResponse } from 'ireports-contracts';
import { routesV1 } from '@/config/app.routes';
import { ListAllEmployeeIdentitiesService } from '../../application/services/list-all-employee-identities.service';

// Гард снят по решению пользователя — см. пояснение в
// create-employee-identity.http.controller.ts.
// import { PortalAdminGuard } from '@/integrations/bitrix/auth/portal-admin.guard';

// @UseGuards(PortalAdminGuard)
@ApiTags('Идентификация сотрудников')
@Controller(routesV1.version)
export class ListAllEmployeeIdentitiesHttpController {
    constructor(
        private readonly listAllEmployeeIdentities: ListAllEmployeeIdentitiesService,
    ) {}

    @Get(routesV1.employeeIdentity.root)
    @ApiOperation({
        summary: 'Все связи сотрудников с внешними системами',
    })
    async list(): Promise<EmployeeIdentityResponse[]> {
        return this.listAllEmployeeIdentities.execute();
    }
}
