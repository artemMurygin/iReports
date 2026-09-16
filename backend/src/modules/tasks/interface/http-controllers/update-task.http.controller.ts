import { Body, Controller, Param, Patch } from '@nestjs/common';
import { CommandBus } from '@nestjs/cqrs';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import type { Task } from 'ireports-contracts';
import { routesV1 } from '@/config/app.routes';
import { UpdateTaskCommand } from '@/modules/tasks/application/command/update-task/update-task.command';
import { GetTaskService } from '@/modules/tasks/application/services/get-task.service';
import { UpdateTaskDto } from '../dto/update-task.dto';

// openspec/changes/edit-task/specs/tasks/spec.md, Requirement:
// «Редактирование полей активной задачи» — частичное обновление
// title/description/deadline/assigneeEmployeeId уже существующей задачи.
// Недоступно для задачи в терминальном статусе (TaskAlreadyClosedException,
// маппится DomainExceptionFilter'ом в 409, см. exception.codes.ts). Тот же
// приём, что ChangeTaskStatusHttpController: команда через CommandBus,
// ответ — актуальная задача через GetTaskService.
@ApiTags('Задачи')
@Controller()
export class UpdateTaskHttpController {
    constructor(
        private readonly commandBus: CommandBus,
        private readonly getTask: GetTaskService,
    ) {}

    @Patch(routesV1.tasks.byId)
    @ApiOperation({
        summary:
            'Изменить поля существующей задачи (заголовок/описание/дедлайн/ответственный)',
    })
    async update(
        @Param('id') id: string,
        @Body() body: UpdateTaskDto,
    ): Promise<Task> {
        await this.commandBus.execute(
            new UpdateTaskCommand({
                taskId: id,
                title: body.title,
                description: body.description,
                // isoDateStringSchema — строка в теле запроса (см. WHY у
                // updateTaskRequestSchema в contracts/commands/task.ts), та же
                // конвертация, что и в CreateTaskHttpController.
                deadline:
                    body.deadline !== undefined
                        ? new Date(body.deadline)
                        : undefined,
                assigneeEmployeeId: body.assigneeEmployeeId,
            }),
        );
        return this.getTask.execute(id);
    }
}
