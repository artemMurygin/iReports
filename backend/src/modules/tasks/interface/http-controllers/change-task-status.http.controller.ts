import { Body, Controller, Param, Patch, Req } from '@nestjs/common';
import { CommandBus } from '@nestjs/cqrs';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import type { Request } from 'express';
import type { Task } from 'ireports-contracts';
import { routesV1 } from '@/config/app.routes';
import type { AuthenticatedRequestUser } from '@/modules/session/interface/session-auth.guard';
import { ChangeTaskStatusCommand } from '@/modules/tasks/application/command/change-task-status/change-task-status.command';
import { GetTaskService } from '@/modules/tasks/application/services/get-task.service';
import { ChangeTaskStatusDto } from '../dto/change-task-status.dto';

// specs/tasks/spec.md, Requirements «Ответственный сотрудник ведёт задачу
// до готовности» / «Проверка и закрытие задачи руководителем» / «Возврат с
// доработки в работу» — contracts/commands/task.ts (WHY у
// changeTaskStatusRequestSchema): actorEmployeeId НЕ приходит в теле
// запроса — резолвится из сессии аутентифицированного пользователя
// (request.user, заполняется глобальным APP_GUARD/SessionAuthGuard в
// app.module.ts), тем же приёмом, что GetCurrentUserHttpController.
// ChangeTaskStatusHandler проверяет только сам граф переходов
// (TaskStatus.canTransitionTo), не то, имеет ли этот сотрудник право
// совершать переход (RBAC вне скоупа этого change).
@ApiTags('Задачи')
@Controller()
export class ChangeTaskStatusHttpController {
    constructor(
        private readonly commandBus: CommandBus,
        private readonly getTask: GetTaskService,
    ) {}

    @Patch(routesV1.tasks.changeStatus)
    @ApiOperation({
        summary:
            'Перевести задачу в новый статус (self-service переход ответственного/руководителя по графу TaskStatus)',
    })
    async changeStatus(
        @Param('id') id: string,
        @Body() body: ChangeTaskStatusDto,
        @Req() req: Request,
    ): Promise<Task> {
        const actorEmployeeId = (
            req as Request & { user: AuthenticatedRequestUser }
        ).user.employeeId;

        await this.commandBus.execute(
            new ChangeTaskStatusCommand({
                taskId: id,
                targetStatus: body.targetStatus,
                actorEmployeeId,
            }),
        );
        return this.getTask.execute(id);
    }
}
