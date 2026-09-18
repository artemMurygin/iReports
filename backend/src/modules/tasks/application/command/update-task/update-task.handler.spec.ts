import { withRequestContext } from '@/shared/testing/with-request-context';
import { Task } from '@/modules/tasks/domain/entities/task.entity';
import { InMemoryTaskRepository } from '@/modules/tasks/infrastructure/repositories/in-memory-task.repository';
import {
    TaskAlreadyClosedException,
    TaskNotFoundException,
} from '@/modules/tasks/domain/exceptions/task.exception';
import { TaskStatus } from '@/modules/tasks/domain/value-objects/task-status.value-object';
import { UpdateTaskHandler } from './update-task.handler';
import { UpdateTaskCommand } from './update-task.command';

describe('UpdateTaskHandler', () => {
    const build = () => {
        const taskRepo = new InMemoryTaskRepository();
        return { handler: new UpdateTaskHandler(taskRepo), taskRepo };
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

    it('находит Task, применяет патч и персистит', async () => {
        const { handler, taskRepo } = build();
        const task = seedTask(taskRepo);

        await withRequestContext(() =>
            handler.execute(
                new UpdateTaskCommand({
                    taskId: task.id,
                    title: 'Новое название',
                    deadline: new Date('2026-10-15T00:00:00.000Z'),
                }),
            ),
        );

        const updated = taskRepo.store.get(task.id)!;
        expect(updated.title).toBe('Новое название');
        expect(updated.deadline).toEqual(new Date('2026-10-15T00:00:00.000Z'));
    });

    it('несуществующая задача — TaskNotFoundException, taskRepo.update не вызывается', async () => {
        const { handler, taskRepo } = build();
        const updateSpy = jest.spyOn(taskRepo, 'update');

        await expect(
            withRequestContext(() =>
                handler.execute(
                    new UpdateTaskCommand({
                        taskId: 'missing',
                        title: 'Новое название',
                    }),
                ),
            ),
        ).rejects.toThrow(TaskNotFoundException);

        expect(updateSpy).not.toHaveBeenCalled();
    });

    it('задача в терминальном статусе — TaskAlreadyClosedException пробрасывается, taskRepo.update не вызывается', async () => {
        const { handler, taskRepo } = build();
        const task = seedTask(taskRepo);
        withRequestContext(() => {
            task.transitionTo(TaskStatus.fromCode('IN_PROGRESS'), 42);
            task.transitionTo(TaskStatus.fromCode('DONE'), 42);
            task.transitionTo(TaskStatus.fromCode('CLOSED_SUCCESSFULLY'), 42);
        });
        taskRepo.store.set(task.id, task);
        const updateSpy = jest.spyOn(taskRepo, 'update');

        await expect(
            withRequestContext(() =>
                handler.execute(
                    new UpdateTaskCommand({
                        taskId: task.id,
                        title: 'Новое название',
                    }),
                ),
            ),
        ).rejects.toThrow(TaskAlreadyClosedException);

        expect(updateSpy).not.toHaveBeenCalled();
    });
});
