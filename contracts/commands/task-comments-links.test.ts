import { describe, expect, it } from 'vitest';
import {
    taskCommentSchema,
    createTaskCommentRequestSchema,
    taskLinkSchema,
    createTaskLinkRequestSchema,
} from './task';

// add-task-salary-rule-links-comments, tasks.md 20.1 — TaskComment/TaskLink парсят валидные данные
// и отклоняют некорректные (пустой текст, невалидный URL).

describe('taskCommentSchema', () => {
    // spec: tasks/comments#Requirement: Комментарий фиксирует автора, время и текст
    it('parses a valid comment', () => {
        const result = taskCommentSchema.safeParse({
            id: 'comment-1',
            taskId: 'task-1',
            authorEmployeeId: 42,
            text: 'Готово, файл во вложении',
            createdAt: '2026-09-10T12:00:00.000Z',
        });

        expect(result.success).toBe(true);
        if (result.success) {
            expect(result.data.createdAt).toBeInstanceOf(Date);
            expect(result.data.authorEmployeeId).toBe(42);
        }
    });

    // spec: tasks/comments#Requirement: Пустой комментарий отклоняется
    it('rejects an empty text', () => {
        const result = taskCommentSchema.safeParse({
            id: 'comment-1',
            taskId: 'task-1',
            authorEmployeeId: 42,
            text: '',
            createdAt: '2026-09-10T12:00:00.000Z',
        });

        expect(result.success).toBe(false);
    });

    it('rejects a missing required field', () => {
        const result = taskCommentSchema.safeParse({
            taskId: 'task-1',
            authorEmployeeId: 42,
            text: 'Готово',
            createdAt: '2026-09-10T12:00:00.000Z',
        });

        expect(result.success).toBe(false);
    });
});

describe('createTaskCommentRequestSchema', () => {
    // spec: tasks/comments#Requirement: Пустой комментарий отклоняется
    it('accepts a non-empty text', () => {
        expect(
            createTaskCommentRequestSchema.safeParse({ text: 'Комментарий' })
                .success,
        ).toBe(true);
    });

    it('rejects an empty text', () => {
        expect(createTaskCommentRequestSchema.safeParse({ text: '' }).success).toBe(
            false,
        );
    });
});

describe('taskLinkSchema', () => {
    // spec: tasks/links#Requirement: Задача может иметь несколько ссылок
    it('parses a valid link with a label', () => {
        const result = taskLinkSchema.safeParse({
            id: 'link-1',
            taskId: 'task-1',
            url: 'https://example.com/result.pdf',
            label: 'Результат работы',
            createdAt: '2026-09-10T12:00:00.000Z',
        });

        expect(result.success).toBe(true);
    });

    it('parses a valid link without a label', () => {
        const result = taskLinkSchema.safeParse({
            id: 'link-1',
            taskId: 'task-1',
            url: 'https://example.com',
            createdAt: '2026-09-10T12:00:00.000Z',
        });

        expect(result.success).toBe(true);
    });

    // spec: tasks/links#Requirement: Ссылка должна быть валидным адресом
    it('rejects a syntactically invalid URL', () => {
        const result = taskLinkSchema.safeParse({
            id: 'link-1',
            taskId: 'task-1',
            url: 'не-ссылка',
            createdAt: '2026-09-10T12:00:00.000Z',
        });

        expect(result.success).toBe(false);
    });
});

describe('createTaskLinkRequestSchema', () => {
    // spec: tasks/links#Requirement: Ссылка должна быть валидным адресом
    it('accepts a valid URL', () => {
        expect(
            createTaskLinkRequestSchema.safeParse({
                url: 'https://example.com',
            }).success,
        ).toBe(true);
    });

    it('rejects an invalid URL', () => {
        expect(
            createTaskLinkRequestSchema.safeParse({ url: 'not-a-url' }).success,
        ).toBe(false);
    });
});
