import { withRequestContext } from '@/shared/testing/with-request-context';
import { TaskCommentBody } from './task-comment-body.value-object';
import { TaskCommentBodyEmptyException } from '../exceptions/task.exception';

// spec: tasks/comments#requirement-пустой-комментарий-отклоняется
describe('TaskCommentBody', () => {
    it('принимает непустой текст', () => {
        const body = TaskCommentBody.create('Проверил цифры, всё сходится');
        expect(body.value).toBe('Проверил цифры, всё сходится');
    });

    it('бросает TaskCommentBodyEmptyException на пустую строку', () => {
        expect(() =>
            withRequestContext(() => TaskCommentBody.create('')),
        ).toThrow(TaskCommentBodyEmptyException);
    });

    it('бросает TaskCommentBodyEmptyException на строку из одних пробелов', () => {
        expect(() =>
            withRequestContext(() => TaskCommentBody.create('    ')),
        ).toThrow(TaskCommentBodyEmptyException);
    });
});
