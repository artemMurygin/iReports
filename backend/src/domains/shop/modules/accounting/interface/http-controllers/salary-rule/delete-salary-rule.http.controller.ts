import {
    Controller,
    Delete,
    HttpCode,
    HttpStatus,
    Param,
} from '@nestjs/common';
import { CommandBus } from '@nestjs/cqrs';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { routesV1 } from '@/config/app.routes';
import { DeleteShopSalaryRuleCommand } from '@/domains/shop/modules/accounting/application/command/motivation-schema/delete-salary-rule.command';

// Зеркало domains/service/.../delete-salary-rule.http.controller.ts —
// удаление правила направления shop вместе с его задачей, немедленно.
@ApiTags('Бухгалтерия: зарплатные правила магазина')
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
