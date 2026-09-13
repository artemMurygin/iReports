import { Controller, HttpCode, HttpStatus, Param, Post } from '@nestjs/common';
import { CommandBus } from '@nestjs/cqrs';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { routesV1 } from '@/config/app.routes';
import { ReactivateShopSalaryRuleCommand } from '@/domains/shop/modules/accounting/application/command/motivation-schema/reactivate-salary-rule.command';

// Зеркало domains/service/.../reactivate-salary-rule.http.controller.ts —
// реактивация ранее деактивированного правила направления shop. Связанные
// задачи (TaskCompletion) не затрагиваются.
@ApiTags('Бухгалтерия: зарплатные правила магазина')
@Controller()
export class ReactivateShopSalaryRuleHttpController {
    constructor(private readonly commandBus: CommandBus) {}

    @Post(routesV1.shop.accounting.salaryRules.activate)
    @HttpCode(HttpStatus.NO_CONTENT)
    @ApiOperation({
        summary:
            'Реактивировать ранее деактивированное зарплатное правило направления shop (несуществующее — 404)',
    })
    async activate(@Param('ruleId') ruleId: string): Promise<void> {
        await this.commandBus.execute(
            new ReactivateShopSalaryRuleCommand({ ruleId }),
        );
    }
}
