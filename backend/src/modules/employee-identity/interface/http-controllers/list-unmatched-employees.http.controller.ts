import { Controller, Get, UseGuards } from '@nestjs/common';
import type { UnmatchedEmployeeResponse } from 'ireports-contracts';
import { routesV1 } from '@/config/app.routes';
import { PortalAdminGuard } from '@/integrations/bitrix/auth/portal-admin.guard';
import { ListUnmatchedEmployeesService } from '../../application/services/list-unmatched-employees.service';

@UseGuards(PortalAdminGuard)
@Controller(routesV1.version)
export class ListUnmatchedEmployeesHttpController {
    constructor(
        private readonly listUnmatchedEmployees: ListUnmatchedEmployeesService,
    ) {}

    @Get(routesV1.employeeIdentity.unmatched)
    async list(): Promise<UnmatchedEmployeeResponse[]> {
        return this.listUnmatchedEmployees.execute();
    }
}
