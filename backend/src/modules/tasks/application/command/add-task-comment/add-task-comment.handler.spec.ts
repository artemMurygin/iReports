import { withRequestContext } from '@/shared/testing/with-request-context';
import { InMemoryTaskCommentRepository } from '@/modules/tasks/infrastructure/repositories/in-memory-task-comment.repository';
import { TaskCommentBodyEmptyException } from '@/modules/tasks/domain/exceptions/task.exception';
import { AddTaskCommentHandler } from './add-task-comment.handler';
import { AddTaskCommentCommand } from './add-task-comment.command';

// spec: tasks/comments#Requirement: Комментарий фиксирует автора, время и текст
// spec: tasks/comments#Requirement: Пустой комментарий отклоняется
describe('AddTaskCommentHandler', () => {
    const build = () => {
        const taskCommentRepo = new InMemoryTaskCommentRepository();
        return {
            handler: new AddTaskCommentHandler(taskCommentRepo),
            taskCommentRepo,
        };
    };

    it('создаёт и сохраняет TaskComment с автором из переданного authorEmployeeId', async () => {
        const { handler, taskCommentRepo } = build();

        const comment = await withRequestContext(() =>
            handler.execute(
                new AddTaskCommentCommand({
                    taskId: 'task-1',
                    authorEmployeeId: 42,
                    text: 'Готово, файл во вложении',
                }),
            ),
        );

        expect(comment.taskId).toBe('task-1');
        expect(comment.authorEmployeeId).toBe(42);
        expect(comment.text).toBe('Готово, файл во вложении');
        expect(taskCommentRepo.store.get(comment.id)).toBeDefined();
    });

    it('отклоняет пустой текст до записи в репозиторий', async () => {
        const { handler, taskCommentRepo } = build();

        await expect(
            withRequestContext(() =>
                handler.execute(
                    new AddTaskCommentCommand({
                        taskId: 'task-1',
                        authorEmployeeId: 42,
                        text: '   ',
                    }),
                ),
            ),
        ).rejects.toThrow(TaskCommentBodyEmptyException);

        expect(taskCommentRepo.store.size).toBe(0);
    });
});
