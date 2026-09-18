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
import { DeactivateSalaryRuleCommand } from '@/domains/service/modules/accounting/application/command/motivation-schema/deactivate-salary-rule.command';

// Soft-деактивация ОДНОГО правила направления service — правило перестаёт
// участвовать в расчётах и пропадает из UI схемы, но не удаляется физически
// (в отличие от DeleteSalaryRuleHttpController). Связанные задачи
// (TaskCompletion) не затрагиваются.
@ApiTags('Бухгалтерия: зарплатные правила')
@UseGuards(SessionAuthGuard, CsrfGuard, PermissionsGuard)
@RequirePermissions('service-accounting:manage_schema')
@Controller()
export class DeactivateSalaryRuleHttpController {
    constructor(private readonly commandBus: CommandBus) {}

    @Post(routesV1.service.accounting.salaryRules.deactivate)
    @HttpCode(HttpStatus.NO_CONTENT)
    @ApiOperation({
        summary:
            'Деактивировать зарплатное правило направления service (несуществующее — 404). Правило перестаёт участвовать в расчётах, но не удаляется',
    })
    async deactivate(@Param('ruleId') ruleId: string): Promise<void> {
        await this.commandBus.execute(
            new DeactivateSalaryRuleCommand({ ruleId }),
        );
    }
}
