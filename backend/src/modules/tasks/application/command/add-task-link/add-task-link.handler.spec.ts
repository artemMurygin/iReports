import { withRequestContext } from '@/shared/testing/with-request-context';
import { InMemoryTaskLinkRepository } from '@/modules/tasks/infrastructure/repositories/in-memory-task-link.repository';
import { InvalidTaskLinkUrlException } from '@/modules/tasks/domain/exceptions/task.exception';
import { AddTaskLinkHandler } from './add-task-link.handler';
import { AddTaskLinkCommand } from './add-task-link.command';

// spec: tasks/links#Requirement: Ссылка должна быть валидным адресом
// spec: tasks/links#Requirement: Задача может иметь несколько ссылок
describe('AddTaskLinkHandler', () => {
    const build = () => {
        const taskLinkRepo = new InMemoryTaskLinkRepository();
        return { handler: new AddTaskLinkHandler(taskLinkRepo), taskLinkRepo };
    };

    it('создаёт и сохраняет TaskLink с валидным URL', async () => {
        const { handler, taskLinkRepo } = build();

        const link = await withRequestContext(() =>
            handler.execute(
                new AddTaskLinkCommand({
                    taskId: 'task-1',
                    url: 'https://example.com/result.pdf',
                    label: 'Результат работы',
                }),
            ),
        );

        expect(link.taskId).toBe('task-1');
        expect(link.url.value).toBe('https://example.com/result.pdf');
        expect(link.label).toBe('Результат работы');
        expect(taskLinkRepo.store.get(link.id)).toBeDefined();
    });

    it('отклоняет невалидный URL до записи в репозиторий', async () => {
        const { handler, taskLinkRepo } = build();

        await expect(
            withRequestContext(() =>
                handler.execute(
                    new AddTaskLinkCommand({
                        taskId: 'task-1',
                        url: 'не-ссылка',
                    }),
                ),
            ),
        ).rejects.toThrow(InvalidTaskLinkUrlException);

        expect(taskLinkRepo.store.size).toBe(0);
    });

    it('не теряет уже существующие ссылки задачи при добавлении новой', async () => {
        const { handler, taskLinkRepo } = build();
        await withRequestContext(() =>
            handler.execute(
                new AddTaskLinkCommand({
                    taskId: 'task-1',
                    url: 'https://example.com/one',
                }),
            ),
        );

        await withRequestContext(() =>
            handler.execute(
                new AddTaskLinkCommand({
                    taskId: 'task-1',
                    url: 'https://example.com/two',
                }),
            ),
        );

        const links = await taskLinkRepo.findByTaskId('task-1');
        expect(links.map((l) => l.url.value)).toEqual([
            'https://example.com/one',
            'https://example.com/two',
        ]);
    });
});
