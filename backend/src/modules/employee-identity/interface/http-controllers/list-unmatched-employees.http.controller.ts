import { Controller, Get, UseGuards } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import type { UnmatchedEmployeeResponse } from 'ireports-contracts';
import { routesV1 } from '@/config/app.routes';
import { PortalAdminGuard } from '@/integrations/bitrix/auth/portal-admin.guard';
import { ListUnmatchedEmployeesService } from '../../application/services/list-unmatched-employees.service';

@UseGuards(PortalAdminGuard)
@ApiTags('Идентификация сотрудников')
@Controller(routesV1.version)
export class ListUnmatchedEmployeesHttpController {
    constructor(
        private readonly listUnmatchedEmployees: ListUnmatchedEmployeesService,
    ) {}

    @Get(routesV1.employeeIdentity.unmatched)
    @ApiOperation({
        summary: 'Сотрудники Bitrix без единой связи ни в одной системе',
    })
    async list(): Promise<UnmatchedEmployeeResponse[]> {
        return this.listUnmatchedEmployees.execute();
    }
}
