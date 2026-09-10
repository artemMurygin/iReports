import { withRequestContext } from '@/shared/testing/with-request-context';
import { TaskLinkUrl } from './task-link-url.value-object';
import { InvalidTaskLinkUrlException } from '../exceptions/task.exception';

// spec: tasks/links#requirement-ссылка-должна-быть-валидным-адресом
describe('TaskLinkUrl', () => {
    it('принимает синтаксически валидный URL', () => {
        const url = TaskLinkUrl.create('https://example.com/report.pdf');
        expect(url.value).toBe('https://example.com/report.pdf');
    });

    it('бросает InvalidTaskLinkUrlException на невалидное значение', () => {
        expect(() =>
            withRequestContext(() => TaskLinkUrl.create('не ссылка')),
        ).toThrow(InvalidTaskLinkUrlException);
    });

    it('бросает InvalidTaskLinkUrlException на пустую строку', () => {
        expect(() => withRequestContext(() => TaskLinkUrl.create(''))).toThrow(
            InvalidTaskLinkUrlException,
        );
    });
});
