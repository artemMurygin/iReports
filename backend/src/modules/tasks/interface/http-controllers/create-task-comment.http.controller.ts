import { Body, Controller, Param, Post, Req } from '@nestjs/common';
import { CommandBus } from '@nestjs/cqrs';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import type { Request } from 'express';
import type { TaskComment } from 'ireports-contracts';
import { routesV1 } from '@/config/app.routes';
import type { AuthenticatedRequestUser } from '@/modules/session/interface/session-auth.guard';
import { AddTaskCommentCommand } from '@/modules/tasks/application/command/add-task-comment/add-task-comment.command';
import { TaskComment as TaskCommentEntity } from '@/modules/tasks/domain/entities/task-comment.entity';
import { toTaskCommentResponse } from '@/modules/tasks/application/mappers/to-task-comment-response';
import { CreateTaskCommentDto } from '../dto/create-task-comment.dto';

// spec: tasks/comments#Requirement: Комментарий фиксирует автора, время и
// текст — автор ОБЯЗАТЕЛЬНО резолвится из req.user.employeeId
// (SessionAuthGuard), а не из тела запроса (architecture.md, «HTTP-эндпоинты»),
// тем же приёмом, что ChangeTaskStatusHttpController.
@ApiTags('Задачи: комментарии')
@Controller()
export class CreateTaskCommentHttpController {
    constructor(private readonly commandBus: CommandBus) {}

    @Post(routesV1.tasks.comments)
    @ApiOperation({
        summary:
            'Добавить комментарий к задаче (автор — текущий пользователь сессии, пустой текст отклоняется)',
    })
    async create(
        @Param('id') id: string,
        @Body() body: CreateTaskCommentDto,
        @Req() req: Request,
    ): Promise<TaskComment> {
        const authorEmployeeId = (
            req as Request & { user: AuthenticatedRequestUser }
        ).user.employeeId;

        const comment = await this.commandBus.execute<
            AddTaskCommentCommand,
            TaskCommentEntity
        >(
            new AddTaskCommentCommand({
                taskId: id,
                authorEmployeeId,
                text: body.text,
            }),
        );
        return toTaskCommentResponse(comment);
    }
}
