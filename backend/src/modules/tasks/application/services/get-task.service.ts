import { Inject, Injectable } from '@nestjs/common';
import type { Task as TaskContract } from 'ireports-contracts';
import { TASK_REPOSITORY } from '@/modules/tasks/application/ports/task.repository.port';
import type { TaskRepositoryPort } from '@/modules/tasks/application/ports/task.repository.port';
import { TaskNotFoundException } from '@/modules/tasks/domain/exceptions/task.exception';
import { toTaskResponse } from '../mappers/to-task-response';

// GET /v1/tasks/:id (specs/tasks/spec.md, Requirement: «Задача видна в
// интерфейсе на любой стадии жизненного цикла») — карточка задачи, не
// зависит от того, ссылается ли на неё в этот момент зарплатное правило.
@Injectable()
export class GetTaskService {
    constructor(
        @Inject(TASK_REPOSITORY)
        private readonly taskRepo: TaskRepositoryPort,
    ) {}

    async execute(taskId: string): Promise<TaskContract> {
        const task = await this.taskRepo.findById(taskId);
        if (!task) {
            throw new TaskNotFoundException();
        }
        return toTaskResponse(task);
    }
}
