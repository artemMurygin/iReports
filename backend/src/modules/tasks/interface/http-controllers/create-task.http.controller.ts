import { Body, Controller, Post, UseGuards } from '@nestjs/common';
import { CommandBus } from '@nestjs/cqrs';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import type { CreateTaskResponse } from 'ireports-contracts';
import { routesV1 } from '@/config/app.routes';
import { SessionAuthGuard } from '@/modules/session/interface/session-auth.guard';
import { CsrfGuard } from '@/modules/session/interface/csrf.guard';
import { PermissionsGuard } from '@/modules/roles/interface/permissions.guard';
import { RequirePermissions } from '@/shared/decorators/require-permissions.decorator';
import { CreateTaskCommand } from '@/modules/tasks/application/command/create-task/create-task.command';
import { CreateTaskDto } from '../dto/create-task.dto';

@ApiTags('Задачи')
@UseGuards(SessionAuthGuard, CsrfGuard, PermissionsGuard)
@RequirePermissions('tasks:create')
@Controller()
export class CreateTaskHttpController {
    constructor(private readonly commandBus: CommandBus) {}

    // Единственный вход создания задачи (design.md решение 1/4): и эта
    // HTTP-ручка (форма с фронта — features/CreateTask, шаг 1 мастера
    // создания правила TaskCompletion), и accounting (EnsureRuleTaskForPeriodService)
    // диспатчат один и тот же CreateTaskCommand через CommandBus.
    @Post(routesV1.tasks.root)
    @ApiOperation({
        summary:
            'Создать самостоятельную задачу (заголовок, описание, дедлайн, ответственный) — не знает о зарплатных правилах',
    })
    async create(@Body() body: CreateTaskDto): Promise<CreateTaskResponse> {
        const command = new CreateTaskCommand({
            title: body.title,
            description: body.description,
            deadline: new Date(body.deadline),
            assigneeEmployeeId: body.assigneeEmployeeId,
            direction: body.direction,
        });
        return this.commandBus.execute(command);
    }
}
