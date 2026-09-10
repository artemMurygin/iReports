import type { TaskLink } from '@/modules/tasks/domain/entities/task-link.entity';

export interface TaskLinkRepositoryPort {
    // Сохраняет новую ссылку.
    insert(link: TaskLink): Promise<void>;

    // Все ссылки задачи.
    // spec: tasks/links#requirement-задача-может-иметь-несколько-ссылок
    findByTaskId(taskId: string): Promise<TaskLink[]>;

    // Удаляет ссылку по id.
    // spec: tasks/links#requirement-ссылка-удаляется-из-карточки-задачи
    delete(linkId: string): Promise<void>;
}

export const TASK_LINK_REPOSITORY = Symbol('TASK_LINK_REPOSITORY');
