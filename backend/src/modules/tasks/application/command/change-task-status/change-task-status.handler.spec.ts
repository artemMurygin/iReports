import { withRequestContext } from '@/shared/testing/with-request-context';
import { Task } from '@/modules/tasks/domain/entities/task.entity';
import { InMemoryTaskRepository } from '@/modules/tasks/infrastructure/repositories/in-memory-task.repository';
import { InvalidTaskTransitionException } from '@/modules/tasks/domain/exceptions/task.exception';
import { TaskNotFoundException } from '@/modules/tasks/domain/exceptions/task.exception';
import { ChangeTaskStatusHandler } from './change-task-status.handler';
import { ChangeTaskStatusCommand } from './change-task-status.command';

describe('ChangeTaskStatusHandler', () => {
    const build = () => {
        const taskRepo = new InMemoryTaskRepository();
        return { handler: new ChangeTaskStatusHandler(taskRepo), taskRepo };
    };

    const seedTask = (taskRepo: InMemoryTaskRepository) => {
        const task = withRequestContext(() =>
            Task.create({
                title: 'Задача',
                deadline: new Date('2026-09-30T00:00:00.000Z'),
                assigneeEmployeeId: 42,
            }),
        );
        taskRepo.store.set(task.id, task);
        return task;
    };

    it('находит Task, применяет допустимый переход и персистит', async () => {
        const { handler, taskRepo } = build();
        const task = seedTask(taskRepo);

        await withRequestContext(() =>
            handler.execute(
                new ChangeTaskStatusCommand({
                    taskId: task.id,
                    targetStatus: 'IN_PROGRESS',
                    actorEmployeeId: 42,
                }),
            ),
        );

        expect(taskRepo.store.get(task.id)!.status.code).toBe('IN_PROGRESS');
    });

    it('пробрасывает InvalidTaskTransitionException на недопустимом переходе и не меняет состояние', async () => {
        const { handler, taskRepo } = build();
        const task = seedTask(taskRepo);

        await expect(
            withRequestContext(() =>
                handler.execute(
                    new ChangeTaskStatusCommand({
                        taskId: task.id,
                        targetStatus: 'CLOSED_SUCCESSFULLY',
                        actorEmployeeId: 42,
                    }),
                ),
            ),
        ).rejects.toThrow(InvalidTaskTransitionException);

        expect(taskRepo.store.get(task.id)!.status.code).toBe('NEW');
    });

    it('несуществующая задача — TaskNotFoundException', async () => {
        const { handler } = build();

        await expect(
            withRequestContext(() =>
                handler.execute(
                    new ChangeTaskStatusCommand({
                        taskId: 'missing',
                        targetStatus: 'IN_PROGRESS',
                        actorEmployeeId: 42,
                    }),
                ),
            ),
        ).rejects.toThrow(TaskNotFoundException);
    });
});
