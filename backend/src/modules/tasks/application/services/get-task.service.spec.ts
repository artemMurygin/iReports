import { withRequestContext } from '@/shared/testing/with-request-context';
import { Task } from '@/modules/tasks/domain/entities/task.entity';
import { InMemoryTaskRepository } from '@/modules/tasks/infrastructure/repositories/in-memory-task.repository';
import { TaskNotFoundException } from '@/modules/tasks/domain/exceptions/task.exception';
import { GetTaskService } from './get-task.service';

// specs/tasks/spec.md, Requirement: «Задача видна в интерфейсе на любой
// стадии жизненного цикла».
describe('GetTaskService', () => {
    const build = () => {
        const taskRepo = new InMemoryTaskRepository();
        return { service: new GetTaskService(taskRepo), taskRepo };
    };

    it('возвращает задачу по id', async () => {
        const { service, taskRepo } = build();
        const task = withRequestContext(() =>
            Task.create({
                title: 'Задача',
                deadline: new Date('2026-09-30T00:00:00.000Z'),
                assigneeEmployeeId: 42,
            }),
        );
        taskRepo.store.set(task.id, task);

        const result = await service.execute(task.id);

        expect(result.id).toBe(task.id);
        expect(result.status).toBe('NEW');
    });

    it('404/NotFoundException, если taskId не существует', async () => {
        const { service } = build();

        await expect(
            withRequestContext(() => service.execute('missing')),
        ).rejects.toThrow(TaskNotFoundException);
    });
});
