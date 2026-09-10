import { Controller, Get, Param } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import type { TaskComment } from 'ireports-contracts';
import { routesV1 } from '@/config/app.routes';
import { ListTaskCommentsService } from '@/modules/tasks/application/services/list-task-comments.service';

// spec: tasks/comments#Requirement: Комментарии видны каждому, кто открывает
// карточку задачи
@ApiTags('Задачи: комментарии')
@Controller()
export class ListTaskCommentsHttpController {
    constructor(private readonly listTaskComments: ListTaskCommentsService) {}

    @Get(routesV1.tasks.comments)
    @ApiOperation({
        summary:
            'Список комментариев задачи в хронологическом порядке (от старого к новому)',
    })
    async list(@Param('id') id: string): Promise<TaskComment[]> {
        return this.listTaskComments.execute(id);
    }
}
