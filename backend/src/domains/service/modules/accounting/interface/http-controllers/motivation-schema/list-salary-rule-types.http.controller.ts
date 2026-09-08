import { Controller, Get } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import type { SalaryRuleTypesResponse } from 'ireports-contracts';
import { routesV1 } from '@/config/app.routes';
import { ListSalaryRuleTypesService } from '../../../application/services/motivation-schema/list-salary-rule-types.service';

@ApiTags('Бухгалтерия: типы правил')
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
