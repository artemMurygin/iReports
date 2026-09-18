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
import { DeleteShopSalaryRuleCommand } from '@/domains/shop/modules/accounting/application/command/motivation-schema/delete-salary-rule.command';

// Зеркало domains/service/.../delete-salary-rule.http.controller.ts —
// удаление правила направления shop вместе с его задачей, немедленно.
@ApiTags('Бухгалтерия: зарплатные правила магазина')
@UseGuards(SessionAuthGuard, CsrfGuard, PermissionsGuard)
@RequirePermissions('shop-accounting:manage_schema')
@Controller()
export class DeleteShopSalaryRuleHttpController {
    constructor(private readonly commandBus: CommandBus) {}

    @Delete(routesV1.shop.accounting.salaryRules.byId)
    @HttpCode(HttpStatus.NO_CONTENT)
    @ApiOperation({
        summary:
            'Удалить зарплатное правило направления shop вместе с его задачей (несуществующее — 404). Безвозвратно',
    })
    async delete(@Param('ruleId') ruleId: string): Promise<void> {
        await this.commandBus.execute(
            new DeleteShopSalaryRuleCommand({ ruleId }),
        );
    }
}
