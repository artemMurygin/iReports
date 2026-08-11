import { Controller, Get } from '@nestjs/common';
import type { SalaryRuleTypesResponse } from 'ireports-contracts';
import { routesV1 } from '@/config/app.routes';
import { ListShopSalaryRuleTypesService } from '../../application/services/list-salary-rule-types.service';

// GET /shop/accounting/salary_role_types — типы зарплатных правил магазина
// (Фаза 12, issue #61: "GET списка типов правил возвращает разные наборы
// для service и shop"). Зеркало ListSalaryRuleTypesHttpController сервиса,
// но отдельный роут (см. app.routes.ts, routesV1.shopAccounting) — не
// query-параметр на общем '/accounting/salary_role_types'.
@Controller()
export class ListShopSalaryRuleTypesHttpController {
    constructor(
        private readonly listShopSalaryRuleTypes: ListShopSalaryRuleTypesService,
    ) {}

    @Get(routesV1.shopAccounting.salaryRuleTypes)
    list(): SalaryRuleTypesResponse {
        return this.listShopSalaryRuleTypes.execute();
    }
}
