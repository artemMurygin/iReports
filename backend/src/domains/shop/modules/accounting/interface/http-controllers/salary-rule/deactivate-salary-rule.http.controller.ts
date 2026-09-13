import { Controller, HttpCode, HttpStatus, Param, Post } from '@nestjs/common';
import { CommandBus } from '@nestjs/cqrs';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { routesV1 } from '@/config/app.routes';
import { DeactivateShopSalaryRuleCommand } from '@/domains/shop/modules/accounting/application/command/motivation-schema/deactivate-salary-rule.command';

// Зеркало domains/service/.../deactivate-salary-rule.http.controller.ts —
// soft-деактивация ОДНОГО правила направления shop: правило перестаёт
// участвовать в расчётах и пропадает из UI схемы, но не удаляется физически
// (в отличие от DeleteShopSalaryRuleHttpController). Связанные задачи
// (TaskCompletion) не затрагиваются.
@ApiTags('Бухгалтерия: зарплатные правила магазина')
@Controller()
export class DeactivateShopSalaryRuleHttpController {
    constructor(private readonly commandBus: CommandBus) {}

    @Post(routesV1.shop.accounting.salaryRules.deactivate)
    @HttpCode(HttpStatus.NO_CONTENT)
    @ApiOperation({
        summary:
            'Деактивировать зарплатное правило направления shop (несуществующее — 404). Правило перестаёт участвовать в расчётах, но не удаляется',
    })
    async deactivate(@Param('ruleId') ruleId: string): Promise<void> {
        await this.commandBus.execute(
            new DeactivateShopSalaryRuleCommand({ ruleId }),
        );
    }
}
