import { describe, expect, it } from 'vitest';
import {
    taskCompletionSalaryConfigRequestSchema,
    taskCompletionSalaryConfigResponseSchema,
} from './salary-rule';
import {
    taskCompletionShopSalaryConfigRequestSchema,
    taskCompletionShopSalaryConfigResponseSchema,
} from './shop-salary-rule';

// recurring-task-deadline-offset, tasks.md 8.1 — deadlinePeriodOffset (0..3, дефолт 0) в
// request/response-схемах TaskCompletion (service/shop): 0 — дедлайн в месяце периода задачи,
// 1..3 — смещение на следующий(-е) период(-ы) вперёд (см. proposal.md/design.md).

const validTaskCompletionRequest = {
    taskId: 'task-1',
    taskTitleTemplate: 'Сделать X',
    isRecurring: true,
    deadlineTemplate: '2026-09-30',
    defaultAmount: 5000,
    accountingPeriod: '2026-09',
};

const validTaskCompletionResponse = {
    taskTitleTemplate: 'Сделать X',
    isRecurring: true,
    deadlineTemplate: '2026-09-30',
    defaultAmount: 5000,
    taskIdByPeriod: { '2026-09': 'task-1' },
    accountingPeriod: '2026-09',
};

describe('taskCompletionSalaryConfigRequestSchema (service) — deadlinePeriodOffset', () => {
    it.each([0, 1, 2, 3])('accepts %i as a valid offset', (deadlinePeriodOffset) => {
        const result = taskCompletionSalaryConfigRequestSchema.safeParse({
            ...validTaskCompletionRequest,
            deadlinePeriodOffset,
        });

        expect(result.success).toBe(true);
    });

    it('defaults to 0 when the field is absent', () => {
        const result = taskCompletionSalaryConfigRequestSchema.safeParse(
            validTaskCompletionRequest,
        );

        expect(result.success).toBe(true);
        if (result.success) {
            expect(result.data.deadlinePeriodOffset).toBe(0);
        }
    });

    it.each([-1, 4, 1.5])('rejects %s as an invalid offset', (deadlinePeriodOffset) => {
        const result = taskCompletionSalaryConfigRequestSchema.safeParse({
            ...validTaskCompletionRequest,
            deadlinePeriodOffset,
        });

        expect(result.success).toBe(false);
    });
});

describe('taskCompletionSalaryConfigResponseSchema (service) — deadlinePeriodOffset', () => {
    it.each([0, 1, 2, 3])('accepts %i as a valid offset', (deadlinePeriodOffset) => {
        const result = taskCompletionSalaryConfigResponseSchema.safeParse({
            ...validTaskCompletionResponse,
            deadlinePeriodOffset,
        });

        expect(result.success).toBe(true);
    });

    it('defaults to 0 when the field is absent (legacy persisted rule)', () => {
        const result = taskCompletionSalaryConfigResponseSchema.safeParse(
            validTaskCompletionResponse,
        );

        expect(result.success).toBe(true);
        if (result.success) {
            expect(result.data.deadlinePeriodOffset).toBe(0);
        }
    });

    it.each([-1, 4, 1.5])('rejects %s as an invalid offset', (deadlinePeriodOffset) => {
        const result = taskCompletionSalaryConfigResponseSchema.safeParse({
            ...validTaskCompletionResponse,
            deadlinePeriodOffset,
        });

        expect(result.success).toBe(false);
    });
});

const validTaskCompletionShopRequest = {
    taskId: 'task-1',
    taskTitleTemplate: 'Сделать X',
    isRecurring: true,
    deadlineTemplate: '2026-09-30',
    defaultAmount: 5000,
    accountingPeriod: '2026-09',
};

const validTaskCompletionShopResponse = {
    taskTitleTemplate: 'Сделать X',
    isRecurring: true,
    deadlineTemplate: '2026-09-30',
    defaultAmount: 5000,
    taskIdByPeriod: { '2026-09': 'task-1' },
    accountingPeriod: '2026-09',
};

describe('taskCompletionShopSalaryConfigRequestSchema (shop) — deadlinePeriodOffset', () => {
    it.each([0, 1, 2, 3])('accepts %i as a valid offset', (deadlinePeriodOffset) => {
        const result = taskCompletionShopSalaryConfigRequestSchema.safeParse({
            ...validTaskCompletionShopRequest,
            deadlinePeriodOffset,
        });

        expect(result.success).toBe(true);
    });

    it('defaults to 0 when the field is absent', () => {
        const result = taskCompletionShopSalaryConfigRequestSchema.safeParse(
            validTaskCompletionShopRequest,
        );

        expect(result.success).toBe(true);
        if (result.success) {
            expect(result.data.deadlinePeriodOffset).toBe(0);
        }
    });

    it.each([-1, 4, 1.5])('rejects %s as an invalid offset', (deadlinePeriodOffset) => {
        const result = taskCompletionShopSalaryConfigRequestSchema.safeParse({
            ...validTaskCompletionShopRequest,
            deadlinePeriodOffset,
        });

        expect(result.success).toBe(false);
    });
});

describe('taskCompletionShopSalaryConfigResponseSchema (shop) — deadlinePeriodOffset', () => {
    it.each([0, 1, 2, 3])('accepts %i as a valid offset', (deadlinePeriodOffset) => {
        const result = taskCompletionShopSalaryConfigResponseSchema.safeParse({
            ...validTaskCompletionShopResponse,
            deadlinePeriodOffset,
        });

        expect(result.success).toBe(true);
    });

    it('defaults to 0 when the field is absent (legacy persisted rule)', () => {
        const result = taskCompletionShopSalaryConfigResponseSchema.safeParse(
            validTaskCompletionShopResponse,
        );

        expect(result.success).toBe(true);
        if (result.success) {
            expect(result.data.deadlinePeriodOffset).toBe(0);
        }
    });

    it.each([-1, 4, 1.5])('rejects %s as an invalid offset', (deadlinePeriodOffset) => {
        const result = taskCompletionShopSalaryConfigResponseSchema.safeParse({
            ...validTaskCompletionShopResponse,
            deadlinePeriodOffset,
        });

        expect(result.success).toBe(false);
    });
});
