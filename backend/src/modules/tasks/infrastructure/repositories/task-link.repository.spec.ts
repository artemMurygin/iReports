import { withRequestContext } from '@/shared/testing/with-request-context';
import type { DatabaseService } from '@/infrustructure/database/database.service';
import { TaskLink } from '@/modules/tasks/domain/entities/task-link.entity';
import { TaskLinkRepository } from './task-link.repository';

// spec: tasks/links#requirement-задача-может-иметь-несколько-ссылок —
// insert сохраняет ссылку, findByTaskId отдаёт все ссылки задачи, delete
// удаляет по id. По прецеденту task.repository.spec.ts: мокается
// Prisma-клиент на границе, реальная БД не поднимается.
describe('TaskLinkRepository', () => {
    const buildLink = () =>
        withRequestContext(() =>
            TaskLink.create({
                taskId: 'task-1',
                url: 'https://example.com/report.pdf',
                label: 'Отчёт',
            }),
        );

    const buildRepository = () => {
        const create = jest.fn();
        const findMany = jest.fn();
        const deleteMock = jest.fn();
        const client = {
            taskLink: { create, findMany, delete: deleteMock },
        };
        const db = {
            getClient: () => client,
            withTransaction: (callback: () => Promise<unknown>) => callback(),
        } as unknown as DatabaseService;

        return {
            repository: new TaskLinkRepository(db),
            create,
            findMany,
            deleteMock,
        };
    };

    describe('insert', () => {
        it('передаёт поля ссылки в Prisma create', async () => {
            const { repository, create } = buildRepository();
            create.mockResolvedValueOnce({});
            const link = buildLink();

            await withRequestContext(() => repository.insert(link));

            expect(create).toHaveBeenCalledTimes(1);
            expect(create).toHaveBeenCalledWith({
                data: expect.objectContaining({
                    id: link.id,
                    taskId: 'task-1',
                    url: 'https://example.com/report.pdf',
                    label: 'Отчёт',
                }) as unknown,
            });
        });
    });

    describe('findByTaskId', () => {
        it('запрашивает все ссылки задачи', async () => {
            const { repository, findMany } = buildRepository();
            findMany.mockResolvedValueOnce([]);

            await repository.findByTaskId('task-1');

            expect(findMany).toHaveBeenCalledWith({
                where: { taskId: 'task-1' },
                orderBy: { createdAt: 'asc' },
            });
        });

        it('возвращает пустой массив для задачи без ссылок', async () => {
            const { repository, findMany } = buildRepository();
            findMany.mockResolvedValueOnce([]);

            const result = await repository.findByTaskId('task-without-links');

            expect(result).toEqual([]);
        });

        it('маппит найденные записи в доменные сущности', async () => {
            const { repository, findMany } = buildRepository();
            const now = new Date('2026-09-01T00:00:00.000Z');
            findMany.mockResolvedValueOnce([
                {
                    id: 'link-1',
                    taskId: 'task-1',
                    url: 'https://example.com/a.pdf',
                    label: null,
                    createdAt: now,
                },
            ]);

            const result = await repository.findByTaskId('task-1');

            expect(result).toHaveLength(1);
            expect(result[0].id).toBe('link-1');
            expect(result[0].url.value).toBe('https://example.com/a.pdf');
        });
    });

    describe('delete', () => {
        it('удаляет ссылку по id', async () => {
            const { repository, deleteMock } = buildRepository();
            deleteMock.mockResolvedValueOnce({});

            await withRequestContext(() => repository.delete('link-1'));

            expect(deleteMock).toHaveBeenCalledWith({
                where: { id: 'link-1' },
            });
        });
    });
});
