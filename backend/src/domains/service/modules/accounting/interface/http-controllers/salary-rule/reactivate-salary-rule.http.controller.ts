import { Controller, HttpCode, HttpStatus, Param, Post } from '@nestjs/common';
import { CommandBus } from '@nestjs/cqrs';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { routesV1 } from '@/config/app.routes';
import { ReactivateSalaryRuleCommand } from '@/domains/service/modules/accounting/application/command/motivation-schema/reactivate-salary-rule.command';

// Обратная операция к DeactivateSalaryRuleHttpController — возвращает ранее
// деактивированное правило направления service в активное состояние.
@ApiTags('Бухгалтерия: зарплатные правила')
@Controller()
export class ReactivateSalaryRuleHttpController {
    constructor(private readonly commandBus: CommandBus) {}

    @Post(routesV1.service.accounting.salaryRules.activate)
    @HttpCode(HttpStatus.NO_CONTENT)
    @ApiOperation({
        summary:
            'Активировать ранее деактивированное зарплатное правило направления service (несуществующее — 404)',
    })
    async activate(@Param('ruleId') ruleId: string): Promise<void> {
        await this.commandBus.execute(
            new ReactivateSalaryRuleCommand({ ruleId }),
        );
    }
}
