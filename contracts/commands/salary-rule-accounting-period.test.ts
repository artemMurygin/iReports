import { describe, expect, it } from 'vitest';
import {
    taskCompletionSalaryConfigRequestSchema,
    taskCompletionSalaryConfigResponseSchema,
} from './salary-rule';
import {
    taskCompletionShopSalaryConfigRequestSchema,
    taskCompletionShopSalaryConfigResponseSchema,
} from './shop-salary-rule';

// add-task-salary-rule-accounting-period, tasks.md 1.1 — accountingPeriod ('YYYY-MM') обязателен в
// request-схемах TaskCompletion (service/shop) и опционален в response-схемах (design.md, Decision 1:
// обратная совместимость с уже персистированными правилами без этого поля в props).

const validTaskCompletionRequest = {
    taskId: 'task-1',
    taskTitleTemplate: 'Сделать X',
    isRecurring: false,
    deadlineTemplate: '2026-09-30',
    defaultAmount: 5000,
    accountingPeriod: '2026-09',
};

const validTaskCompletionResponse = {
    taskTitleTemplate: 'Сделать X',
    isRecurring: false,
    deadlineTemplate: '2026-09-30',
    defaultAmount: 5000,
    taskIdByPeriod: { '2026-09': 'task-1' },
    accountingPeriod: '2026-09',
};

describe('taskCompletionSalaryConfigRequestSchema (service)', () => {
    it('parses a valid accountingPeriod', () => {
        const result = taskCompletionSalaryConfigRequestSchema.safeParse(
            validTaskCompletionRequest,
        );

        expect(result.success).toBe(true);
    });

    it('rejects a missing accountingPeriod', () => {
        const { accountingPeriod: _accountingPeriod, ...withoutPeriod } =
            validTaskCompletionRequest;

        const result = taskCompletionSalaryConfigRequestSchema.safeParse(withoutPeriod);

        expect(result.success).toBe(false);
    });

    it('rejects an invalid accountingPeriod format', () => {
        const result = taskCompletionSalaryConfigRequestSchema.safeParse({
            ...validTaskCompletionRequest,
            accountingPeriod: '2026-9',
        });

        expect(result.success).toBe(false);
    });
});

describe('taskCompletionSalaryConfigResponseSchema (service)', () => {
    it('parses a response with accountingPeriod present', () => {
        const result = taskCompletionSalaryConfigResponseSchema.safeParse(
            validTaskCompletionResponse,
        );

        expect(result.success).toBe(true);
    });

    it('parses a response with accountingPeriod absent (legacy persisted rule)', () => {
        const { accountingPeriod: _accountingPeriod, ...withoutPeriod } =
            validTaskCompletionResponse;

        const result = taskCompletionSalaryConfigResponseSchema.safeParse(withoutPeriod);

        expect(result.success).toBe(true);
    });

    it('rejects an invalid accountingPeriod format', () => {
        const result = taskCompletionSalaryConfigResponseSchema.safeParse({
            ...validTaskCompletionResponse,
            accountingPeriod: 'not-a-period',
        });

        expect(result.success).toBe(false);
    });
});

const validTaskCompletionShopRequest = {
    taskId: 'task-1',
    taskTitleTemplate: 'Сделать X',
    isRecurring: false,
    deadlineTemplate: '2026-09-30',
    defaultAmount: 5000,
    accountingPeriod: '2026-09',
};

const validTaskCompletionShopResponse = {
    taskTitleTemplate: 'Сделать X',
    isRecurring: false,
    deadlineTemplate: '2026-09-30',
    defaultAmount: 5000,
    taskIdByPeriod: { '2026-09': 'task-1' },
    accountingPeriod: '2026-09',
};

describe('taskCompletionShopSalaryConfigRequestSchema (shop)', () => {
    it('parses a valid accountingPeriod', () => {
        const result = taskCompletionShopSalaryConfigRequestSchema.safeParse(
            validTaskCompletionShopRequest,
        );

        expect(result.success).toBe(true);
    });

    it('rejects a missing accountingPeriod', () => {
        const { accountingPeriod: _accountingPeriod, ...withoutPeriod } =
            validTaskCompletionShopRequest;

        const result = taskCompletionShopSalaryConfigRequestSchema.safeParse(withoutPeriod);

        expect(result.success).toBe(false);
    });

    it('rejects an invalid accountingPeriod format', () => {
        const result = taskCompletionShopSalaryConfigRequestSchema.safeParse({
            ...validTaskCompletionShopRequest,
            accountingPeriod: '2026/09',
        });

        expect(result.success).toBe(false);
    });
});

describe('taskCompletionShopSalaryConfigResponseSchema (shop)', () => {
    it('parses a response with accountingPeriod present', () => {
        const result = taskCompletionShopSalaryConfigResponseSchema.safeParse(
            validTaskCompletionShopResponse,
        );

        expect(result.success).toBe(true);
    });

    it('parses a response with accountingPeriod absent (legacy persisted rule)', () => {
        const { accountingPeriod: _accountingPeriod, ...withoutPeriod } =
            validTaskCompletionShopResponse;

        const result = taskCompletionShopSalaryConfigResponseSchema.safeParse(withoutPeriod);

        expect(result.success).toBe(true);
    });

    it('rejects an invalid accountingPeriod format', () => {
        const result = taskCompletionShopSalaryConfigResponseSchema.safeParse({
            ...validTaskCompletionShopResponse,
            accountingPeriod: '26-09',
        });

        expect(result.success).toBe(false);
    });
});
