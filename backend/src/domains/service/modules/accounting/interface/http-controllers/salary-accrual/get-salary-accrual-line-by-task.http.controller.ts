import { Controller, Get, Param, Res } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import type { Response } from 'express';
import type { SalaryAccrualLineSummary } from 'ireports-contracts';
import { routesV1 } from '@/config/app.routes';
import { FindSalaryAccrualForTaskService } from '@/domains/service/modules/accounting/application/services/task-completion/find-salary-accrual-for-task.service';

// Раздел 19 tasks.md (add-task-salary-rule-links-comments) — обратный
// поиск строки начисления по taskId для нижней строки блока «Зарплатное
// правило» на карточке задачи (tasks/salary-rule-panel). null (HTTP 200 с
// телом null), если задача ещё не закрыта успешно либо ни одна строка ни
// одного документа направления service не ссылается на неё — штатный
// случай, не ошибка.
//
// @Res() — см. WHY в get-salary-rule-by-task.http.controller.ts (тот же
// приём, тот же повод: без него Express-адаптер Nest шлёт пустое тело
// вместо JSON-литерала `null`).
@ApiTags('Бухгалтерия: начисления зарплаты')
@Controller()
export class GetSalaryAccrualLineByTaskHttpController {
    constructor(
        private readonly findSalaryAccrualForTask: FindSalaryAccrualForTaskService,
    ) {}

    @Get(routesV1.service.accounting.salaryAccrualLines.byTaskId)
    @ApiOperation({
        summary:
            'Строка начисления зарплаты направления service, отображаемая по задаче (обратный поиск по taskId)',
    })
    async getByTask(
        @Param('taskId') taskId: string,
        @Res() res: Response,
    ): Promise<SalaryAccrualLineSummary | null> {
        const summary = await this.findSalaryAccrualForTask.execute(taskId);
        res.status(200).json(summary);
        return summary;
    }
}
