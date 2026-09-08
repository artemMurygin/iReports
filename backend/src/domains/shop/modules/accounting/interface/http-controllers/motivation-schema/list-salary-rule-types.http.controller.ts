import { Controller, Get } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import type { SalaryRuleTypesResponse } from 'ireports-contracts';
import { routesV1 } from '@/config/app.routes';
import { ListShopSalaryRuleTypesService } from '../../../application/services/motivation-schema/list-salary-rule-types.service';

// GET /shop/accounting/salary_role_types — типы зарплатных правил магазина
// (Фаза 12, issue #61: "GET списка типов правил возвращает разные наборы
// для service и shop"). Зеркало ListSalaryRuleTypesHttpController сервиса,
// но отдельный роут (см. app.routes.ts, routesV1.shop.accounting) — не
// query-параметр на общем '/accounting/salary_role_types'.
@ApiTags('Бухгалтерия: типы правил')
@Controller()
export class ListShopSalaryRuleTypesHttpController {
    constructor(
        private readonly listShopSalaryRuleTypes: ListShopSalaryRuleTypesService,
    ) {}

    @Get(routesV1.shop.accounting.salaryRuleTypes)
    @ApiOperation({
        summary: 'Типы зарплатных правил магазина и допустимые роли',
    })
    list(): SalaryRuleTypesResponse {
        return this.listShopSalaryRuleTypes.execute();
    }
}
