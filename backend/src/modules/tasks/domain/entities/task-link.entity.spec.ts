import { withRequestContext } from '@/shared/testing/with-request-context';
import { TaskLink } from './task-link.entity';
import { TaskLinkUrl } from '../value-objects/task-link-url.value-object';
import { ArgumentInvalidException } from '@/shared/exceptions';

// spec: tasks/links#requirement-задача-может-иметь-несколько-ссылок —
// TaskLink.create/reconstitute/validate.
describe('TaskLink entity', () => {
    const buildLink = (label?: string | null) =>
        withRequestContext(() =>
            TaskLink.create({
                taskId: 'task-1',
                url: 'https://example.com/report.pdf',
                label,
            }),
        );

    describe('create', () => {
        it('создаёт сущность с TaskLinkUrl и createdAt', () => {
            const link = buildLink('Отчёт');
            expect(link.taskId).toBe('task-1');
            expect(link.url.value).toBe('https://example.com/report.pdf');
            expect(link.label).toBe('Отчёт');
            expect(link.createdAt).toBeInstanceOf(Date);
        });

        it('label необязателен — по умолчанию null', () => {
            const link = buildLink();
            expect(link.label).toBeNull();
        });

        it('бросает при невалидном URL (делегирует в TaskLinkUrl)', () => {
            expect(() =>
                withRequestContext(() =>
                    TaskLink.create({ taskId: 'task-1', url: 'не ссылка' }),
                ),
            ).toThrow();
        });
    });

    describe('reconstitute', () => {
        it('восстанавливает сущность из персистентности', () => {
            const createdAt = new Date('2026-09-01T00:00:00.000Z');
            const link = withRequestContext(() =>
                TaskLink.reconstitute({
                    id: 'link-1',
                    createdAt,
                    props: {
                        taskId: 'task-1',
                        url: TaskLinkUrl.create(
                            'https://example.com/report.pdf',
                        ),
                        label: null,
                    },
                }),
            );

            expect(link.id).toBe('link-1');
            expect(link.createdAt).toEqual(createdAt);
            expect(link.url.value).toBe('https://example.com/report.pdf');
        });
    });

    describe('validate', () => {
        it('бросает ArgumentInvalidException при пустом taskId', () => {
            expect(() =>
                withRequestContext(() =>
                    TaskLink.create({
                        taskId: '',
                        url: 'https://example.com',
                    }),
                ),
            ).toThrow(ArgumentInvalidException);
        });
    });
});
