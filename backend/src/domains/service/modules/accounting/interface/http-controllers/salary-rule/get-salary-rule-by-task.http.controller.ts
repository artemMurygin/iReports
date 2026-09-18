import { Controller, Get, Param, Res, UseGuards } from '@nestjs/common';
import { SessionAuthGuard } from '@/modules/session/interface/session-auth.guard';
import { CsrfGuard } from '@/modules/session/interface/csrf.guard';
import { PermissionsGuard } from '@/modules/roles/interface/permissions.guard';
import { RequirePermissions } from '@/shared/decorators/require-permissions.decorator';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import type { Response } from 'express';
import type { SalaryRuleSummary } from 'ireports-contracts';
import { routesV1 } from '@/config/app.routes';
import { FindSalaryRuleForTaskService } from '@/domains/service/modules/accounting/application/services/task-completion/find-salary-rule-for-task.service';

// Раздел 19 tasks.md (add-task-salary-rule-links-comments) — обратный
// поиск зарплатного правила по taskId для блока на карточке задачи
// (tasks/salary-rule-panel), читается фронтендом напрямую (design.md
// решение 2), не backend modules/tasks. null (HTTP 200 с телом null), если
// ни одно правило домена service не ссылается на эту задачу — штатный
// случай (у задачи может не быть связанного правила), а не ошибка, поэтому
// не 404.
//
// @Res() — не идиоматичный для проекта typed-return паттерн (см.
// backend/CLAUDE.md, Swagger), но необходим именно здесь: Express-адаптер
// Nest трактует null/undefined как isNil и шлёт ПУСТОЕ тело
// (response.send() без аргументов, см.
// node_modules/@nestjs/platform-express/adapters/express-adapter.js#reply),
// а не JSON-литерал `null` — фронтенд не смог бы распарсить такой ответ
// через response.json(). @Res() без passthrough отключает автоматический
// reply Nest (см. RouterExecutionContext.isResponseHandled), поэтому ниже
// тело отправляется явно; итоговый Promise<SalaryRuleSummary | null>
// сохранён как объявленный тип метода — для Swagger-схемы ответа, само тело
// уже отправлено до return.
@ApiTags('Бухгалтерия: зарплатные правила')
@UseGuards(SessionAuthGuard, CsrfGuard, PermissionsGuard)
@RequirePermissions('service-accounting:view')
@Controller()
export class GetSalaryRuleByTaskHttpController {
    constructor(
        private readonly findSalaryRuleForTask: FindSalaryRuleForTaskService,
    ) {}

    @Get(routesV1.service.accounting.salaryRules.byTaskId)
    @ApiOperation({
        summary:
            'Зарплатное правило направления service, ссылающееся на задачу (обратный поиск по taskId)',
    })
    async getByTask(
        @Param('taskId') taskId: string,
        @Res() res: Response,
    ): Promise<SalaryRuleSummary | null> {
        const summary = await this.findSalaryRuleForTask.execute(taskId);
        res.status(200).json(summary);
        return summary;
    }
}
