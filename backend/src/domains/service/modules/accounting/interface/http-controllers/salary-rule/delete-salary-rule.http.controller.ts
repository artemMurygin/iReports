import {
    Controller,
    Delete,
    HttpCode,
    HttpStatus,
    Param,
    UseGuards,
} from '@nestjs/common';
import { SessionAuthGuard } from '@/modules/session/interface/session-auth.guard';
import { CsrfGuard } from '@/modules/session/interface/csrf.guard';
import { PermissionsGuard } from '@/modules/roles/interface/permissions.guard';
import { RequirePermissions } from '@/shared/decorators/require-permissions.decorator';
import { CommandBus } from '@nestjs/cqrs';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { routesV1 } from '@/config/app.routes';
import { DeleteSalaryRuleCommand } from '@/domains/service/modules/accounting/application/command/motivation-schema/delete-salary-rule.command';

// add-task-rule-task-lifecycle — удаление ОДНОГО правила направления
// service вместе с его задачей, немедленно (без отдельного PATCH схемы).
// Используется формой правила TaskCompletion при удалении уже сохранённой
// задачи ("Удалить задачу" — для правила, ещё не сохранённого хотя бы раз,
// форма просто чистит черновик локально, см. features/SalaryRuleForm).
@ApiTags('Бухгалтерия: зарплатные правила')
@UseGuards(SessionAuthGuard, CsrfGuard, PermissionsGuard)
@RequirePermissions('service-accounting:manage_schema')
@Controller()
export class DeleteSalaryRuleHttpController {
    constructor(private readonly commandBus: CommandBus) {}

    @Delete(routesV1.service.accounting.salaryRules.byId)
    @HttpCode(HttpStatus.NO_CONTENT)
    @ApiOperation({
        summary:
            'Удалить зарплатное правило направления service вместе с его задачей (несуществующее — 404). Безвозвратно',
    })
    async delete(@Param('ruleId') ruleId: string): Promise<void> {
        await this.commandBus.execute(new DeleteSalaryRuleCommand({ ruleId }));
    }
}
