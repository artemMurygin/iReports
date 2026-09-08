import { withRequestContext } from '@/shared/testing/with-request-context';
import { Task } from '@/modules/tasks/domain/entities/task.entity';
import { TaskStatus } from '@/modules/tasks/domain/value-objects/task-status.value-object';
import { InMemoryTaskRepository } from '@/modules/tasks/infrastructure/repositories/in-memory-task.repository';
import { CancelTaskForRuleDeletionService } from './cancel-task-for-rule-deletion.service';

// specs/tasks/spec.md, Requirement: «Отмена правила закрывает
// незавершённую задачу как неуспешную» — вызывается из accounting
// (service/shop) при удалении/отмене TaskCompletion-правила, с уже
// известным taskId (design.md Decision 5/architecture.md — не ищет задачу
// сам, кроме findById по переданному id).
describe('CancelTaskForRuleDeletionService', () => {
    const build = () => {
        const taskRepo = new InMemoryTaskRepository();
        return {
            service: new CancelTaskForRuleDeletionService(taskRepo),
            taskRepo,
        };
    };

    const seedTask = (
        taskRepo: InMemoryTaskRepository,
        status: 'NEW' | 'IN_PROGRESS' | 'DONE' | 'CLOSED_SUCCESSFULLY',
    ) => {
        const task = withRequestContext(() => {
            const t = Task.create({
                title: 'Задача правила',
                deadline: new Date('2026-09-30T00:00:00.000Z'),
                assigneeEmployeeId: 42,
            });
            if (status !== 'NEW') {
                t.transitionTo(TaskStatus.fromCode('IN_PROGRESS'), 42);
            }
            if (status === 'DONE' || status === 'CLOSED_SUCCESSFULLY') {
                t.transitionTo(TaskStatus.fromCode('DONE'), 42);
            }
            if (status === 'CLOSED_SUCCESSFULLY') {
                t.transitionTo(TaskStatus.fromCode('CLOSED_SUCCESSFULLY'), 7);
            }
            return t;
        });
        taskRepo.store.set(task.id, task);
        return task;
    };

    it('находит Task по id и переводит незавершённую задачу в CLOSED_UNSUCCESSFULLY', async () => {
        const { service, taskRepo } = build();
        const task = seedTask(taskRepo, 'IN_PROGRESS');

        await service.cancel(task.id);

        expect(taskRepo.store.get(task.id)!.status.code).toBe(
            'CLOSED_UNSUCCESSFULLY',
        );
    });

    it('no-op на уже терминальной задаче — не трогает персистентность лишний раз', async () => {
        const { service, taskRepo } = build();
        const task = seedTask(taskRepo, 'CLOSED_SUCCESSFULLY');
        const updateSpy = jest.spyOn(taskRepo, 'update');

        await service.cancel(task.id);

        expect(taskRepo.store.get(task.id)!.status.code).toBe(
            'CLOSED_SUCCESSFULLY',
        );
        expect(updateSpy).not.toHaveBeenCalled();
    });

    it('несуществующий taskId — no-op, без исключения (design.md Risks: осиротевшая/удалённая ссылка)', async () => {
        const { service } = build();

        await expect(service.cancel('missing')).resolves.toBeUndefined();
    });
});
