import { Controller, Get, Param, UseGuards } from '@nestjs/common';
import { SessionAuthGuard } from '@/modules/session/interface/session-auth.guard';
import { CsrfGuard } from '@/modules/session/interface/csrf.guard';
import { PermissionsGuard } from '@/modules/roles/interface/permissions.guard';
import { RequirePermissions } from '@/shared/decorators/require-permissions.decorator';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import type { SalaryRuleDetail } from 'ireports-contracts';
import { routesV1 } from '@/config/app.routes';
import { GetSalaryRuleService } from '@/domains/service/modules/accounting/application/services/task-completion/get-salary-rule.service';

// Раздел 19 tasks.md (add-task-salary-rule-links-comments) — read-only
// боковая панель зарплатного правила (features/SalaryRuleDetailsPanel,
// useSalaryRule(ruleId, direction)). GetSalaryRuleService бросает
// SalaryRuleNotFoundException, если правила с таким id нет (или оно
// принадлежит направлению shop) — DomainExceptionFilter переводит её в
// HTTP 404 (см. SALARY_RULE_NOT_FOUND в domain-exception.filter.ts).
@ApiTags('Бухгалтерия: зарплатные правила')
@UseGuards(SessionAuthGuard, CsrfGuard, PermissionsGuard)
@RequirePermissions('service-accounting:view')
@Controller()
export class GetSalaryRuleHttpController {
    constructor(private readonly getSalaryRule: GetSalaryRuleService) {}

    @Get(routesV1.service.accounting.salaryRules.byId)
    @ApiOperation({
        summary:
            'Зарплатное правило направления service по собственному id (боковая панель правила)',
    })
    async get(@Param('ruleId') ruleId: string): Promise<SalaryRuleDetail> {
        return this.getSalaryRule.execute(ruleId);
    }
}
