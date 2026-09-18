import { Controller, Get, UseGuards } from '@nestjs/common';
import { SessionAuthGuard } from '@/modules/session/interface/session-auth.guard';
import { CsrfGuard } from '@/modules/session/interface/csrf.guard';
import { PermissionsGuard } from '@/modules/roles/interface/permissions.guard';
import { RequirePermissions } from '@/shared/decorators/require-permissions.decorator';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import type { SalaryRuleTypesResponse } from 'ireports-contracts';
import { routesV1 } from '@/config/app.routes';
import { ListSalaryRuleTypesService } from '../../../application/services/motivation-schema/list-salary-rule-types.service';

@ApiTags('Бухгалтерия: типы правил')
@UseGuards(SessionAuthGuard, CsrfGuard, PermissionsGuard)
@RequirePermissions('service-accounting:view')
@Controller()
export class ListSalaryRuleTypesHttpController {
    constructor(
        private readonly listSalaryRuleTypes: ListSalaryRuleTypesService,
    ) {}

    @Get(routesV1.service.accounting.salaryRuleTypes)
    @ApiOperation({
        summary: 'Типы зарплатных правил сервиса и допустимые роли',
    })
    list(): SalaryRuleTypesResponse {
        return this.listSalaryRuleTypes.execute();
    }
}
