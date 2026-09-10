import { withRequestContext } from '@/shared/testing/with-request-context';
import type { DatabaseService } from '@/infrustructure/database/database.service';
import { TaskComment } from '@/modules/tasks/domain/entities/task-comment.entity';
import { TaskCommentRepository } from './task-comment.repository';

// spec: tasks/comments#requirement-комментарий-фиксирует-автора-время-и-текст —
// insert сохраняет комментарий, findByTaskId отдаёт комментарии задачи по
// возрастанию createdAt. По прецеденту task.repository.spec.ts: мокается
// Prisma-клиент на границе, реальная БД не поднимается.
describe('TaskCommentRepository', () => {
    const buildComment = () =>
        withRequestContext(() =>
            TaskComment.create({
                taskId: 'task-1',
                authorEmployeeId: 42,
                text: 'Проверил результат, всё в порядке',
            }),
        );

    const buildRepository = () => {
        const create = jest.fn();
        const findMany = jest.fn();
        const client = { taskComment: { create, findMany } };
        const db = {
            getClient: () => client,
            withTransaction: (callback: () => Promise<unknown>) => callback(),
        } as unknown as DatabaseService;

        return {
            repository: new TaskCommentRepository(db),
            create,
            findMany,
        };
    };

    describe('insert', () => {
        it('передаёт поля комментария в Prisma create', async () => {
            const { repository, create } = buildRepository();
            create.mockResolvedValueOnce({});
            const comment = buildComment();

            await withRequestContext(() => repository.insert(comment));

            expect(create).toHaveBeenCalledTimes(1);
            expect(create).toHaveBeenCalledWith({
                data: expect.objectContaining({
                    id: comment.id,
                    taskId: 'task-1',
                    authorEmployeeId: 42,
                    body: 'Проверил результат, всё в порядке',
                }) as unknown,
            });
        });
    });

    describe('findByTaskId', () => {
        it('запрашивает комментарии задачи по возрастанию createdAt', async () => {
            const { repository, findMany } = buildRepository();
            findMany.mockResolvedValueOnce([]);

            await repository.findByTaskId('task-1');

            expect(findMany).toHaveBeenCalledWith({
                where: { taskId: 'task-1' },
                orderBy: { createdAt: 'asc' },
            });
        });

        it('возвращает пустой массив для задачи без комментариев', async () => {
            const { repository, findMany } = buildRepository();
            findMany.mockResolvedValueOnce([]);

            const result = await repository.findByTaskId(
                'task-without-comments',
            );

            expect(result).toEqual([]);
        });

        it('маппит найденные записи в доменные сущности', async () => {
            const { repository, findMany } = buildRepository();
            const older = new Date('2026-09-01T00:00:00.000Z');
            const newer = new Date('2026-09-02T00:00:00.000Z');
            findMany.mockResolvedValueOnce([
                {
                    id: 'comment-1',
                    taskId: 'task-1',
                    authorEmployeeId: 42,
                    body: 'Первый комментарий',
                    createdAt: older,
                },
                {
                    id: 'comment-2',
                    taskId: 'task-1',
                    authorEmployeeId: 7,
                    body: 'Второй комментарий',
                    createdAt: newer,
                },
            ]);

            const result = await repository.findByTaskId('task-1');

            expect(result).toHaveLength(2);
            expect(result[0].id).toBe('comment-1');
            expect(result[0].text).toBe('Первый комментарий');
            expect(result[1].id).toBe('comment-2');
            expect(result[1].authorEmployeeId).toBe(7);
        });
    });
});
