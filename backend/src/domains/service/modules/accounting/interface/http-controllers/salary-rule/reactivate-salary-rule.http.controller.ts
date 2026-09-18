import {
    Controller,
    HttpCode,
    HttpStatus,
    Param,
    Post,
    UseGuards,
} from '@nestjs/common';
import { SessionAuthGuard } from '@/modules/session/interface/session-auth.guard';
import { CsrfGuard } from '@/modules/session/interface/csrf.guard';
import { PermissionsGuard } from '@/modules/roles/interface/permissions.guard';
import { RequirePermissions } from '@/shared/decorators/require-permissions.decorator';
import { CommandBus } from '@nestjs/cqrs';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { routesV1 } from '@/config/app.routes';
import { ReactivateSalaryRuleCommand } from '@/domains/service/modules/accounting/application/command/motivation-schema/reactivate-salary-rule.command';

// Обратная операция к DeactivateSalaryRuleHttpController — возвращает ранее
// деактивированное правило направления service в активное состояние.
@ApiTags('Бухгалтерия: зарплатные правила')
@UseGuards(SessionAuthGuard, CsrfGuard, PermissionsGuard)
@RequirePermissions('service-accounting:manage_schema')
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
