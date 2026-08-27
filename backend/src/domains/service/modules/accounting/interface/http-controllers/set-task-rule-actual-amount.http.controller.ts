import { Body, Controller, HttpCode, HttpStatus, Put } from '@nestjs/common';
import { CommandBus } from '@nestjs/cqrs';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { routesV1 } from '@/config/app.routes';
import { SetTaskRuleActualAmountDto } from '../dto/set-task-rule-actual-amount.dto';
import { SetTaskRuleActualAmountCommand } from '@/domains/service/modules/accounting/application/command/set-task-rule-actual-amount.command';

// Requirement "Ручной ввод фактической суммы по закрытой задаче" (spec.md)
// — доступно только на странице зарплатного отчёта сотрудника за открытый
// период, для правила-задачи в статусе "Закрыта" (SetTaskRuleActualAmountHandler,
// задача 6.4). ruleId уже входит в тело запроса (setTaskRuleActualAmountRequestSchema),
// поэтому без :id в пути, в отличие от остальных byId-эндпоинтов модуля.
@ApiTags('Бухгалтерия: выполнение задач')
@Controller()
export class SetTaskRuleActualAmountHttpController {
    constructor(private readonly commandBus: CommandBus) {}

    @Put(routesV1.service.accounting.taskRuleActualAmount)
    @HttpCode(HttpStatus.NO_CONTENT)
    @ApiOperation({
        summary:
            'Указать фактическую сумму по закрытой задаче правила TaskCompleted',
    })
    async set(@Body() body: SetTaskRuleActualAmountDto): Promise<void> {
        const command = new SetTaskRuleActualAmountCommand({
            ruleId: body.ruleId,
            period: body.period,
            actualAmount: body.actualAmount,
        });
        await this.commandBus.execute(command);
    }
}
