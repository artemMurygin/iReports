import { Controller, Get } from '@nestjs/common';
import type { SalaryRuleTypesResponse } from 'ireports-contracts';
import { ListSalaryRuleTypesService } from '../../application/services/list-salary-rule-types.service';

@Controller('accounting')
export class ListSalaryRuleTypesHttpController {
    constructor(
        private readonly listSalaryRuleTypes: ListSalaryRuleTypesService,
    ) {}

    @Get('salary_role_types')
    list(): SalaryRuleTypesResponse {
        return this.listSalaryRuleTypes.execute();
    }
}
