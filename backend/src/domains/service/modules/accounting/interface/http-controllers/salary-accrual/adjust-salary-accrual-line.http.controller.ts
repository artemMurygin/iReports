import { Body, Controller, Param, Patch, UseGuards } from '@nestjs/common';
import { SessionAuthGuard } from '@/modules/session/interface/session-auth.guard';
import { CsrfGuard } from '@/modules/session/interface/csrf.guard';
import { PermissionsGuard } from '@/modules/roles/interface/permissions.guard';
import { RequirePermissions } from '@/shared/decorators/require-permissions.decorator';
import { CommandBus } from '@nestjs/cqrs';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import type { SalaryAccrualResponse } from 'ireports-contracts';
import { routesV1 } from '@/config/app.routes';
import { AdjustSalaryAccrualLineCommand } from '@/domains/service/modules/accounting/application/command/salary-accrual/adjust-salary-accrual-line.command';
import { AdjustSalaryAccrualLineDto } from '../../dto/salary-accrual/adjust-salary-accrual-line.dto';

@ApiTags('Бухгалтерия: начисления зарплаты')
@UseGuards(SessionAuthGuard, CsrfGuard, PermissionsGuard)
@RequirePermissions('service-accounting:edit_accrual')
@Controller()
export class AdjustSalaryAccrualLineHttpController {
    constructor(private readonly commandBus: CommandBus) {}

    // Комментарий обязателен уже на этой границе
    // (adjustSalaryAccrualLineRequestSchema: comment — min(1)) — 400 раньше,
    // чем запрос дойдёт до домена.
    @Patch(routesV1.service.accounting.salaryAccruals.lineById)
    @ApiOperation({
        summary:
            'Корректировать строку документа начисления до проведения (service)',
    })
    async adjust(
        @Param('id') id: string,
        @Param('lineId') lineId: string,
        @Body() body: AdjustSalaryAccrualLineDto,
    ): Promise<SalaryAccrualResponse> {
        const command = new AdjustSalaryAccrualLineCommand({
            direction: 'service',
            accrualId: id,
            lineId,
            amount: body.amount,
            comment: body.comment,
            adjustedBy: body.adjustedBy,
        });
        return this.commandBus.execute(command);
    }
}
