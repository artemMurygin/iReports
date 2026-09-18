import { Controller, Get, Param, Res, UseGuards } from '@nestjs/common';
import { SessionAuthGuard } from '@/modules/session/interface/session-auth.guard';
import { CsrfGuard } from '@/modules/session/interface/csrf.guard';
import { PermissionsGuard } from '@/modules/roles/interface/permissions.guard';
import { RequirePermissions } from '@/shared/decorators/require-permissions.decorator';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import type { Response } from 'express';
import type { SalaryRuleSummary } from 'ireports-contracts';
import { routesV1 } from '@/config/app.routes';
import { FindSalaryRuleForTaskService } from '@/domains/shop/modules/accounting/application/services/salary-task/find-salary-rule-for-task.service';

// Раздел 19 tasks.md (add-task-salary-rule-links-comments) — зеркало
// domains/service/.../salary-rule/get-salary-rule-by-task.http.controller.ts
// (см. WHY там, включая @Res()).
@ApiTags('Бухгалтерия: зарплатные правила магазина')
@UseGuards(SessionAuthGuard, CsrfGuard, PermissionsGuard)
@RequirePermissions('shop-accounting:view')
@Controller()
export class GetShopSalaryRuleByTaskHttpController {
    constructor(
        private readonly findSalaryRuleForTask: FindSalaryRuleForTaskService,
    ) {}

    @Get(routesV1.shop.accounting.salaryRules.byTaskId)
    @ApiOperation({
        summary:
            'Зарплатное правило направления shop, ссылающееся на задачу (обратный поиск по taskId)',
    })
    async getByTask(
        @Param('taskId') taskId: string,
        @Res() res: Response,
    ): Promise<SalaryRuleSummary | null> {
        const summary = await this.findSalaryRuleForTask.execute(taskId);
        res.status(200).json(summary);
        return summary;
    }
}
