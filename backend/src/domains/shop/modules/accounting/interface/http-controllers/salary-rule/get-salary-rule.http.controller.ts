import { Controller, Get, Param, UseGuards } from '@nestjs/common';
import { SessionAuthGuard } from '@/modules/session/interface/session-auth.guard';
import { CsrfGuard } from '@/modules/session/interface/csrf.guard';
import { PermissionsGuard } from '@/modules/roles/interface/permissions.guard';
import { RequirePermissions } from '@/shared/decorators/require-permissions.decorator';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import type { SalaryRuleDetail } from 'ireports-contracts';
import { routesV1 } from '@/config/app.routes';
import { GetSalaryRuleService } from '@/domains/shop/modules/accounting/application/services/salary-task/get-salary-rule.service';

// Раздел 19 tasks.md (add-task-salary-rule-links-comments) — зеркало
// domains/service/.../salary-rule/get-salary-rule.http.controller.ts (см.
// WHY там). ShopSalaryRuleNotFoundException переводится
// DomainExceptionFilter в HTTP 404 через тот же общий код
// SALARY_RULE_NOT_FOUND.
@ApiTags('Бухгалтерия: зарплатные правила магазина')
@UseGuards(SessionAuthGuard, CsrfGuard, PermissionsGuard)
@RequirePermissions('shop-accounting:view')
@Controller()
export class GetShopSalaryRuleHttpController {
    constructor(private readonly getSalaryRule: GetSalaryRuleService) {}

    @Get(routesV1.shop.accounting.salaryRules.byId)
    @ApiOperation({
        summary:
            'Зарплатное правило направления shop по собственному id (боковая панель правила)',
    })
    async get(@Param('ruleId') ruleId: string): Promise<SalaryRuleDetail> {
        return this.getSalaryRule.execute(ruleId);
    }
}
