import { Body, Controller, Param, Post } from '@nestjs/common';
import { CommandBus } from '@nestjs/cqrs';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import type { TaskLink } from 'ireports-contracts';
import { routesV1 } from '@/config/app.routes';
import { AddTaskLinkCommand } from '@/modules/tasks/application/command/add-task-link/add-task-link.command';
import { TaskLink as TaskLinkEntity } from '@/modules/tasks/domain/entities/task-link.entity';
import { toTaskLinkResponse } from '@/modules/tasks/application/mappers/to-task-link-response';
import { CreateTaskLinkDto } from '../dto/create-task-link.dto';

// spec: tasks/links#Requirement: Ссылка должна быть валидным адресом
@ApiTags('Задачи: ссылки')
@Controller()
export class CreateTaskLinkHttpController {
    constructor(private readonly commandBus: CommandBus) {}

    @Post(routesV1.tasks.links)
    @ApiOperation({
        summary:
            'Добавить ссылку к задаче (синтаксически невалидный URL отклоняется)',
    })
    async create(
        @Param('id') id: string,
        @Body() body: CreateTaskLinkDto,
    ): Promise<TaskLink> {
        const link = await this.commandBus.execute<
            AddTaskLinkCommand,
            TaskLinkEntity
        >(
            new AddTaskLinkCommand({
                taskId: id,
                url: body.url,
                label: body.label,
            }),
        );
        return toTaskLinkResponse(link);
    }
}
