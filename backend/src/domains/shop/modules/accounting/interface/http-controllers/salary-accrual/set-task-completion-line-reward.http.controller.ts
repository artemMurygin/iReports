import { Body, Controller, Param, Patch, UseGuards } from '@nestjs/common';
import { SessionAuthGuard } from '@/modules/session/interface/session-auth.guard';
import { CsrfGuard } from '@/modules/session/interface/csrf.guard';
import { PermissionsGuard } from '@/modules/roles/interface/permissions.guard';
import { RequirePermissions } from '@/shared/decorators/require-permissions.decorator';
import { CommandBus } from '@nestjs/cqrs';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import type { SalaryAccrualResponse } from 'ireports-contracts';
import { routesV1 } from '@/config/app.routes';
import { SetShopTaskCompletionLineRewardCommand } from '@/domains/shop/modules/accounting/application/command/salary-accrual/set-task-completion-line-reward.command';
import { SetShopTaskCompletionLineRewardDto } from '../../dto/salary-accrual/set-task-completion-line-reward.dto';

// Раздел 18 tasks.md (add-task-based-salary-rule) — зеркало
// SetTaskCompletionLineRewardHttpController сервиса: тонкий HTTP-слой поверх
// собственной, независимой SetShopTaskCompletionLineRewardCommand.
@ApiTags('Бухгалтерия: начисления зарплаты магазина')
@UseGuards(SessionAuthGuard, CsrfGuard, PermissionsGuard)
@RequirePermissions('shop-accounting:edit_accrual')
@Controller()
export class SetShopTaskCompletionLineRewardHttpController {
    constructor(private readonly commandBus: CommandBus) {}

    // Комментарий обязателен уже на этой границе
    // (setTaskCompletionLineRewardRequestSchema: comment — min(1)) — 400
    // раньше, чем запрос дойдёт до домена (тот же приём, что и у
    // AdjustShopSalaryAccrualLineHttpController).
    @Patch(routesV1.shop.accounting.salaryAccruals.lineTaskReward)
    @ApiOperation({
        summary:
            'Первичный ручной ввод суммы+комментария строки «за выполнение задачи» (shop)',
    })
    async setReward(
        @Param('id') id: string,
        @Param('lineId') lineId: string,
        @Body() body: SetShopTaskCompletionLineRewardDto,
    ): Promise<SalaryAccrualResponse> {
        const command = new SetShopTaskCompletionLineRewardCommand({
            accrualId: id,
            lineId,
            amount: body.amount,
            comment: body.comment,
        });
        return this.commandBus.execute(command);
    }
}
