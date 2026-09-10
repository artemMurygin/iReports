import { InMemoryTaskCommentRepository } from '@/modules/tasks/infrastructure/repositories/in-memory-task-comment.repository';
import { TaskComment } from '@/modules/tasks/domain/entities/task-comment.entity';
import { TaskCommentBody } from '@/modules/tasks/domain/value-objects/task-comment-body.value-object';
import { ListTaskCommentsService } from './list-task-comments.service';

// spec: tasks/comments#Requirement: Комментарий фиксирует автора, время и текст
describe('ListTaskCommentsService', () => {
    const build = () => {
        const taskCommentRepo = new InMemoryTaskCommentRepository();
        return {
            service: new ListTaskCommentsService(taskCommentRepo),
            taskCommentRepo,
        };
    };

    const reconstitute = (id: string, createdAt: string, text: string) =>
        TaskComment.reconstitute({
            id,
            createdAt: new Date(createdAt),
            props: {
                taskId: 'task-1',
                authorEmployeeId: 1,
                body: TaskCommentBody.create(text),
            },
        });

    it('отдаёт комментарии задачи в хронологическом порядке (от старого к новому)', async () => {
        const { service, taskCommentRepo } = build();
        const newer = reconstitute(
            'comment-2',
            '2026-09-02T10:00:00.000Z',
            'Новый комментарий',
        );
        const older = reconstitute(
            'comment-1',
            '2026-09-01T10:00:00.000Z',
            'Старый комментарий',
        );
        // Вставлены в обратном порядке — сервис должен отдать их отсортированными.
        await taskCommentRepo.insert(newer);
        await taskCommentRepo.insert(older);

        const result = await service.execute('task-1');

        expect(result.map((c) => c.text)).toEqual([
            'Старый комментарий',
            'Новый комментарий',
        ]);
    });

    it('пустой список для задачи без комментариев', async () => {
        const { service } = build();

        const result = await service.execute('task-without-comments');

        expect(result).toEqual([]);
    });
});
