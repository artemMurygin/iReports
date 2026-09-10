import { describe, expect, it } from 'vitest';
import { salaryAccrualLineSummarySchema } from './salary-accrual';

// add-task-salary-rule-links-comments, tasks.md 20.1 — SalaryAccrualLineSummary парсит валидные
// данные (сумма + статус) и отклоняет некорректные.

describe('salaryAccrualLineSummarySchema', () => {
    // spec: service/accounting#Requirement: Зарплатное правило и начисление доступны для поиска по
    // идентификатору задачи
    it('parses a valid accrued line summary', () => {
        const result = salaryAccrualLineSummarySchema.safeParse({
            id: 'line-1',
            amount: 12000,
            status: 'ACCRUED',
        });

        expect(result.success).toBe(true);
    });

    it('parses a draft line summary', () => {
        const result = salaryAccrualLineSummarySchema.safeParse({
            id: 'line-1',
            amount: 0,
            status: 'DRAFT',
        });

        expect(result.success).toBe(true);
    });

    it('rejects a missing amount', () => {
        const result = salaryAccrualLineSummarySchema.safeParse({
            id: 'line-1',
            status: 'ACCRUED',
        });

        expect(result.success).toBe(false);
    });

    it('rejects an unknown status', () => {
        const result = salaryAccrualLineSummarySchema.safeParse({
            id: 'line-1',
            amount: 12000,
            status: 'NOT_A_STATUS',
        });

        expect(result.success).toBe(false);
    });
});
