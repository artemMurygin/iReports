import { Controller, Get, Param, Res, UseGuards } from '@nestjs/common';
import { SessionAuthGuard } from '@/modules/session/interface/session-auth.guard';
import { CsrfGuard } from '@/modules/session/interface/csrf.guard';
import { PermissionsGuard } from '@/modules/roles/interface/permissions.guard';
import { RequirePermissions } from '@/shared/decorators/require-permissions.decorator';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import type { Response } from 'express';
import type { SalaryAccrualLineSummary } from 'ireports-contracts';
import { routesV1 } from '@/config/app.routes';
import { FindSalaryAccrualForTaskService } from '@/domains/shop/modules/accounting/application/services/salary-task/find-salary-accrual-for-task.service';

// Раздел 19 tasks.md (add-task-salary-rule-links-comments) — зеркало
// domains/service/.../salary-accrual/get-salary-accrual-line-by-task.http.controller.ts
// (см. WHY там, включая @Res()).
@ApiTags('Бухгалтерия: начисления зарплаты магазина')
@UseGuards(SessionAuthGuard, CsrfGuard, PermissionsGuard)
@RequirePermissions('shop-accounting:view_accrual')
@Controller()
export class GetShopSalaryAccrualLineByTaskHttpController {
    constructor(
        private readonly findSalaryAccrualForTask: FindSalaryAccrualForTaskService,
    ) {}

    @Get(routesV1.shop.accounting.salaryAccrualLines.byTaskId)
    @ApiOperation({
        summary:
            'Строка начисления зарплаты направления shop, отображаемая по задаче (обратный поиск по taskId)',
    })
    async getByTask(
        @Param('taskId') taskId: string,
        @Res() res: Response,
    ): Promise<SalaryAccrualLineSummary | null> {
        const summary = await this.findSalaryAccrualForTask.execute(taskId);
        res.status(200).json(summary);
        return summary;
    }
}
