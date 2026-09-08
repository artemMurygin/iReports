import { withRequestContext } from '@/shared/testing/with-request-context';
import { Task } from '@/modules/tasks/domain/entities/task.entity';
import { TaskStatus } from '@/modules/tasks/domain/value-objects/task-status.value-object';
import { InMemoryTaskRepository } from '@/modules/tasks/infrastructure/repositories/in-memory-task.repository';
import { ListTasksService } from './list-tasks.service';

// specs/tasks/spec.md, Requirement: «Задача видна в интерфейсе на любой
// стадии жизненного цикла» — питает GET /v1/tasks (фильтр по
// status/direction для pages/Tasks, ui-design.md).
describe('ListTasksService', () => {
    const build = () => {
        const taskRepo = new InMemoryTaskRepository();
        return { service: new ListTasksService(taskRepo), taskRepo };
    };

    const seed = (
        taskRepo: InMemoryTaskRepository,
        overrides: {
            direction?: 'service' | 'shop';
            status?: 'NEW' | 'IN_PROGRESS';
        } = {},
    ) => {
        const task = withRequestContext(() => {
            const t = Task.create({
                title: 'Задача',
                deadline: new Date('2026-09-30T00:00:00.000Z'),
                assigneeEmployeeId: 42,
                direction: overrides.direction,
            });
            if (overrides.status === 'IN_PROGRESS') {
                t.transitionTo(TaskStatus.fromCode('IN_PROGRESS'), 42);
            }
            return t;
        });
        taskRepo.store.set(task.id, task);
        return task;
    };

    it('без фильтра возвращает все задачи', async () => {
        const { service, taskRepo } = build();
        seed(taskRepo, { direction: 'service' });
        seed(taskRepo, { direction: 'shop' });

        const result = await service.execute({});

        expect(result).toHaveLength(2);
    });

    it('фильтрует по status', async () => {
        const { service, taskRepo } = build();
        seed(taskRepo, { status: 'NEW' });
        const inProgress = seed(taskRepo, { status: 'IN_PROGRESS' });

        const result = await service.execute({ status: 'IN_PROGRESS' });

        expect(result).toHaveLength(1);
        expect(result[0].id).toBe(inProgress.id);
    });

    it('фильтрует по direction', async () => {
        const { service, taskRepo } = build();
        const serviceTask = seed(taskRepo, { direction: 'service' });
        seed(taskRepo, { direction: 'shop' });

        const result = await service.execute({ direction: 'service' });

        expect(result).toHaveLength(1);
        expect(result[0].id).toBe(serviceTask.id);
    });

    it('пустой список — []', async () => {
        const { service } = build();

        const result = await service.execute({});

        expect(result).toEqual([]);
    });
});
