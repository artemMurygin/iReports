import { Body, Controller, Param, Patch, UseGuards } from '@nestjs/common';
import { SessionAuthGuard } from '@/modules/session/interface/session-auth.guard';
import { CsrfGuard } from '@/modules/session/interface/csrf.guard';
import { PermissionsGuard } from '@/modules/roles/interface/permissions.guard';
import { RequirePermissions } from '@/shared/decorators/require-permissions.decorator';
import { CommandBus } from '@nestjs/cqrs';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import type { SalaryAccrualResponse } from 'ireports-contracts';
import { routesV1 } from '@/config/app.routes';
import { SetTaskCompletionLineRewardCommand } from '@/domains/service/modules/accounting/application/command/salary-accrual/set-task-completion-line-reward.command';
import { SetTaskCompletionLineRewardDto } from '../../dto/salary-accrual/set-task-completion-line-reward.dto';

@ApiTags('Бухгалтерия: начисления зарплаты')
@UseGuards(SessionAuthGuard, CsrfGuard, PermissionsGuard)
@RequirePermissions('service-accounting:edit_accrual')
@Controller()
export class SetTaskCompletionLineRewardHttpController {
    constructor(private readonly commandBus: CommandBus) {}

    // Комментарий обязателен уже на этой границе
    // (setTaskCompletionLineRewardRequestSchema: comment — min(1)) — 400
    // раньше, чем запрос дойдёт до домена (тот же приём, что и у
    // AdjustSalaryAccrualLineHttpController).
    @Patch(routesV1.service.accounting.salaryAccruals.lineTaskReward)
    @ApiOperation({
        summary:
            'Первичный ручной ввод суммы+комментария строки «за выполнение задачи» (service)',
    })
    async setReward(
        @Param('id') id: string,
        @Param('lineId') lineId: string,
        @Body() body: SetTaskCompletionLineRewardDto,
    ): Promise<SalaryAccrualResponse> {
        const command = new SetTaskCompletionLineRewardCommand({
            direction: 'service',
            accrualId: id,
            lineId,
            amount: body.amount,
            comment: body.comment,
        });
        return this.commandBus.execute(command);
    }
}
