import { withRequestContext } from '@/shared/testing/with-request-context';
import { Task } from '@/modules/tasks/domain/entities/task.entity';
import { InMemoryTaskRepository } from '@/modules/tasks/infrastructure/repositories/in-memory-task.repository';
import { TaskNotFoundException } from '@/modules/tasks/domain/exceptions/task.exception';
import { DeleteTaskHandler } from './delete-task.handler';
import { DeleteTaskCommand } from './delete-task.command';

describe('DeleteTaskHandler', () => {
    const build = () => {
        const taskRepo = new InMemoryTaskRepository();
        return { handler: new DeleteTaskHandler(taskRepo), taskRepo };
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

    it('удаляет существующую задачу', async () => {
        const { handler, taskRepo } = build();
        const task = seedTask(taskRepo);

        await withRequestContext(() =>
            handler.execute(new DeleteTaskCommand({ taskId: task.id })),
        );

        expect(await taskRepo.findById(task.id)).toBeNull();
    });

    it('бросает TaskNotFoundException для несуществующей задачи', async () => {
        const { handler } = build();

        await expect(
            withRequestContext(() =>
                handler.execute(new DeleteTaskCommand({ taskId: 'missing' })),
            ),
        ).rejects.toThrow(TaskNotFoundException);
    });
});
