import { withRequestContext } from '@/shared/testing/with-request-context';
import { InMemoryTaskLinkRepository } from '@/modules/tasks/infrastructure/repositories/in-memory-task-link.repository';
import { TaskLink } from '@/modules/tasks/domain/entities/task-link.entity';
import { TaskLinkNotFoundException } from '@/modules/tasks/domain/exceptions/task.exception';
import { RemoveTaskLinkHandler } from './remove-task-link.handler';
import { RemoveTaskLinkCommand } from './remove-task-link.command';

// spec: tasks/links#Requirement: Ссылка удаляется из карточки задачи
describe('RemoveTaskLinkHandler', () => {
    const build = () => {
        const taskLinkRepo = new InMemoryTaskLinkRepository();
        return {
            handler: new RemoveTaskLinkHandler(taskLinkRepo),
            taskLinkRepo,
        };
    };

    it('удаляет ссылку по id, не затрагивая остальные ссылки задачи', async () => {
        const { handler, taskLinkRepo } = build();
        const toDelete = withRequestContext(() =>
            TaskLink.create({ taskId: 'task-1', url: 'https://example.com/1' }),
        );
        const toKeep = withRequestContext(() =>
            TaskLink.create({ taskId: 'task-1', url: 'https://example.com/2' }),
        );
        await taskLinkRepo.insert(toDelete);
        await taskLinkRepo.insert(toKeep);

        await withRequestContext(() =>
            handler.execute(
                new RemoveTaskLinkCommand({
                    taskId: 'task-1',
                    linkId: toDelete.id,
                }),
            ),
        );

        const remaining = await taskLinkRepo.findByTaskId('task-1');
        expect(remaining.map((l) => l.id)).toEqual([toKeep.id]);
    });

    it('не удаляет чужую ссылку (принадлежащую другой задаче)', async () => {
        const { handler, taskLinkRepo } = build();
        const foreignLink = withRequestContext(() =>
            TaskLink.create({
                taskId: 'task-other',
                url: 'https://example.com/foreign',
            }),
        );
        await taskLinkRepo.insert(foreignLink);

        await expect(
            withRequestContext(() =>
                handler.execute(
                    new RemoveTaskLinkCommand({
                        taskId: 'task-1',
                        linkId: foreignLink.id,
                    }),
                ),
            ),
        ).rejects.toThrow(TaskLinkNotFoundException);

        expect(taskLinkRepo.store.get(foreignLink.id)).toBeDefined();
    });
});
