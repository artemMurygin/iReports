import { Inject, Injectable } from '@nestjs/common';
import type { Task as TaskContract } from 'ireports-contracts';
import { TASK_REPOSITORY } from '@/modules/tasks/application/ports/task.repository.port';
import type {
    TaskListFilter,
    TaskRepositoryPort,
} from '@/modules/tasks/application/ports/task.repository.port';
import { toTaskResponse } from '../mappers/to-task-response';

// GET /v1/tasks?status=&direction= (specs/tasks/spec.md, Requirement:
// «Задача видна в интерфейсе на любой стадии жизненного цикла»; ui-design.md
// pages/Tasks — чипы «Статус»/«Направление») — оба фильтра необязательны и
// комбинируются. Сортировка — по прецеденту репозитория (createdAt desc),
// отдельной постраничности пока не требуется (объём задач невелик).
@Injectable()
export class ListTasksService {
    constructor(
        @Inject(TASK_REPOSITORY)
        private readonly taskRepo: TaskRepositoryPort,
    ) {}

    async execute(filter: TaskListFilter): Promise<TaskContract[]> {
        const tasks = await this.taskRepo.findMany(filter);
        return tasks.map(toTaskResponse);
    }
}
