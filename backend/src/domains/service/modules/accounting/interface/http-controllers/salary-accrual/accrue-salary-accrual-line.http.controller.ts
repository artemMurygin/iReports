import { Body, Controller, Param, Post, UseGuards } from '@nestjs/common';
import { SessionAuthGuard } from '@/modules/session/interface/session-auth.guard';
import { CsrfGuard } from '@/modules/session/interface/csrf.guard';
import { PermissionsGuard } from '@/modules/roles/interface/permissions.guard';
import { RequirePermissions } from '@/shared/decorators/require-permissions.decorator';
import { CommandBus } from '@nestjs/cqrs';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import type { SalaryAccrualResponse } from 'ireports-contracts';
import { routesV1 } from '@/config/app.routes';
import { AccrueSalaryAccrualLineCommand } from '@/domains/service/modules/accounting/application/command/salary-accrual/accrue-salary-accrual-line.command';
import { AccrueSalaryAccrualLineDto } from '../../dto/salary-accrual/accrue-salary-accrual-line.dto';

@ApiTags('Бухгалтерия: начисления зарплаты')
@UseGuards(SessionAuthGuard, CsrfGuard, PermissionsGuard)
@RequirePermissions('service-accounting:edit_accrual')
@Controller()
export class AccrueSalaryAccrualLineHttpController {
    constructor(private readonly commandBus: CommandBus) {}

    @Post(routesV1.service.accounting.salaryAccruals.lineAccrue)
    @ApiOperation({
        summary:
            'Провести строку документа начисления на баланс сотрудника (service)',
    })
    async accrue(
        @Param('id') id: string,
        @Param('lineId') lineId: string,
        @Body() body: AccrueSalaryAccrualLineDto,
    ): Promise<SalaryAccrualResponse> {
        const command = new AccrueSalaryAccrualLineCommand({
            direction: 'service',
            accrualId: id,
            lineId,
            accruedBy: body.accruedBy,
        });
        return this.commandBus.execute(command);
    }
}
