import { withRequestContext } from '@/shared/testing/with-request-context';
import { TaskComment } from './task-comment.entity';
import { TaskCommentBody } from '../value-objects/task-comment-body.value-object';
import { ArgumentInvalidException } from '@/shared/exceptions';

// spec: tasks/comments#requirement-комментарий-фиксирует-автора-время-и-текст —
// TaskComment.create/reconstitute/validate.
describe('TaskComment entity', () => {
    const buildComment = () =>
        withRequestContext(() =>
            TaskComment.create({
                taskId: 'task-1',
                authorEmployeeId: 42,
                text: 'Проверил результат, всё в порядке',
            }),
        );

    describe('create', () => {
        it('создаёт сущность с TaskCommentBody и createdAt', () => {
            const comment = buildComment();
            expect(comment.taskId).toBe('task-1');
            expect(comment.authorEmployeeId).toBe(42);
            expect(comment.text).toBe('Проверил результат, всё в порядке');
            expect(comment.createdAt).toBeInstanceOf(Date);
        });

        it('бросает при пустом тексте (делегирует в TaskCommentBody)', () => {
            expect(() =>
                withRequestContext(() =>
                    TaskComment.create({
                        taskId: 'task-1',
                        authorEmployeeId: 42,
                        text: '   ',
                    }),
                ),
            ).toThrow();
        });
    });

    describe('reconstitute', () => {
        it('восстанавливает сущность из персистентности', () => {
            const createdAt = new Date('2026-09-01T00:00:00.000Z');
            const comment = withRequestContext(() =>
                TaskComment.reconstitute({
                    id: 'comment-1',
                    createdAt,
                    props: {
                        taskId: 'task-1',
                        authorEmployeeId: 42,
                        body: TaskCommentBody.create('Текст'),
                    },
                }),
            );

            expect(comment.id).toBe('comment-1');
            expect(comment.createdAt).toEqual(createdAt);
            expect(comment.text).toBe('Текст');
        });
    });

    describe('validate', () => {
        it('бросает ArgumentInvalidException при пустом taskId', () => {
            expect(() =>
                withRequestContext(() =>
                    TaskComment.create({
                        taskId: '',
                        authorEmployeeId: 42,
                        text: 'Текст',
                    }),
                ),
            ).toThrow(ArgumentInvalidException);
        });

        it('бросает ArgumentInvalidException при некорректном authorEmployeeId', () => {
            expect(() =>
                withRequestContext(() =>
                    TaskComment.create({
                        taskId: 'task-1',
                        authorEmployeeId: 0,
                        text: 'Текст',
                    }),
                ),
            ).toThrow(ArgumentInvalidException);
        });
    });
});
