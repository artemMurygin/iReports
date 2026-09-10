import { withRequestContext } from '@/shared/testing/with-request-context';
import { InMemoryTaskLinkRepository } from '@/modules/tasks/infrastructure/repositories/in-memory-task-link.repository';
import { TaskLink } from '@/modules/tasks/domain/entities/task-link.entity';
import { ListTaskLinksService } from './list-task-links.service';

// spec: tasks/links#Requirement: Задача может иметь несколько ссылок
describe('ListTaskLinksService', () => {
    const build = () => {
        const taskLinkRepo = new InMemoryTaskLinkRepository();
        return {
            service: new ListTaskLinksService(taskLinkRepo),
            taskLinkRepo,
        };
    };

    it('отдаёт все ссылки задачи', async () => {
        const { service, taskLinkRepo } = build();
        const link1 = withRequestContext(() =>
            TaskLink.create({ taskId: 'task-1', url: 'https://example.com/1' }),
        );
        const link2 = withRequestContext(() =>
            TaskLink.create({
                taskId: 'task-1',
                url: 'https://example.com/2',
                label: 'Документ',
            }),
        );
        await taskLinkRepo.insert(link1);
        await taskLinkRepo.insert(link2);

        const result = await service.execute('task-1');

        expect(result).toEqual([
            expect.objectContaining({
                id: link1.id,
                url: 'https://example.com/1',
            }),
            expect.objectContaining({
                id: link2.id,
                url: 'https://example.com/2',
                label: 'Документ',
            }),
        ]);
    });

    it('пустой список для задачи без ссылок', async () => {
        const { service } = build();

        const result = await service.execute('task-without-links');

        expect(result).toEqual([]);
    });
});
