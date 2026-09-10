import { Inject, Injectable } from '@nestjs/common';
import type { TaskLink as TaskLinkContract } from 'ireports-contracts';
import { TASK_LINK_REPOSITORY } from '@/modules/tasks/application/ports/task-link.repository.port';
import type { TaskLinkRepositoryPort } from '@/modules/tasks/application/ports/task-link.repository.port';
import { toTaskLinkResponse } from '../mappers/to-task-link-response';

// GET /v1/tasks/:id/links — spec: tasks/links#Requirement: Задача может
// иметь несколько ссылок.
@Injectable()
export class ListTaskLinksService {
    constructor(
        @Inject(TASK_LINK_REPOSITORY)
        private readonly taskLinkRepo: TaskLinkRepositoryPort,
    ) {}

    async execute(taskId: string): Promise<TaskLinkContract[]> {
        const links = await this.taskLinkRepo.findByTaskId(taskId);
        return links.map(toTaskLinkResponse);
    }
}
