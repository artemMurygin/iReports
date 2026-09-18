import { describe, expect, it } from 'vitest';
import { salaryRuleSummarySchema, salaryRuleDetailSchema } from './salary-rule';

// add-task-salary-rule-links-comments, tasks.md 20.1 — SalaryRuleSummary/SalaryRuleDetail парсят
// валидные данные и отклоняют некорректные (обязательные поля отсутствуют/пустые).

describe('salaryRuleSummarySchema', () => {
    // spec: service/accounting#Requirement: Зарплатное правило и начисление доступны для поиска по
    // идентификатору задачи
    it('parses a valid summary', () => {
        const result = salaryRuleSummarySchema.safeParse({
            id: 'rule-1',
            name: 'Закрытие задачи',
            type: 'TaskCompletion',
            targetRole: 'ENGINEER',
        });

        expect(result.success).toBe(true);
    });

    it('rejects a missing name', () => {
        const result = salaryRuleSummarySchema.safeParse({
            id: 'rule-1',
            type: 'TaskCompletion',
            targetRole: 'ENGINEER',
        });

        expect(result.success).toBe(false);
    });

    it('rejects an unknown targetRole', () => {
        const result = salaryRuleSummarySchema.safeParse({
            id: 'rule-1',
            name: 'Закрытие задачи',
            type: 'TaskCompletion',
            targetRole: 'NOT_A_ROLE',
        });

        expect(result.success).toBe(false);
    });
});

describe('salaryRuleDetailSchema', () => {
    // spec: service/accounting#Requirement: Зарплатное правило доступно для получения по собственному
    // идентификатору
    it('parses a valid TaskCompletion rule detail', () => {
        const result = salaryRuleDetailSchema.safeParse({
            id: 'rule-1',
            type: 'TaskCompletion',
            name: 'Закрытие задачи',
            targetRole: 'ENGINEER',
            config: {
                taskTitleTemplate: 'Сделать X',
                isRecurring: false,
                deadlineTemplate: '2026-09-30',
                defaultAmount: 5000,
                taskIdByPeriod: { '2026-09': 'task-1' },
            },
            // isActive — обязательное поле ответа (soft-деактивация правила, см.
            // salary-rule.ts); фикстура была написана до добавления этого поля в схему.
            isActive: true,
            direction: 'service',
            motivationSchemaName: 'Инженеры',
        });

        expect(result.success).toBe(true);
    });

    it('parses a valid PayPerHour rule detail', () => {
        const result = salaryRuleDetailSchema.safeParse({
            id: 'rule-2',
            type: 'PayPerHour',
            name: 'Почасовая',
            targetRole: 'ONLINE_MANAGER',
            config: { price: 300 },
            isActive: true,
            direction: 'shop',
            motivationSchemaName: 'Менеджеры',
        });

        expect(result.success).toBe(true);
    });

    it('rejects a missing motivationSchemaName', () => {
        const result = salaryRuleDetailSchema.safeParse({
            id: 'rule-2',
            type: 'PayPerHour',
            name: 'Почасовая',
            targetRole: 'ONLINE_MANAGER',
            config: { price: 300 },
            direction: 'shop',
        });

        expect(result.success).toBe(false);
    });

    it('rejects an unknown direction', () => {
        const result = salaryRuleDetailSchema.safeParse({
            id: 'rule-2',
            type: 'PayPerHour',
            name: 'Почасовая',
            targetRole: 'ONLINE_MANAGER',
            config: { price: 300 },
            direction: 'wholesale',
            motivationSchemaName: 'Менеджеры',
        });

        expect(result.success).toBe(false);
    });

    it('rejects an unknown rule type', () => {
        const result = salaryRuleDetailSchema.safeParse({
            id: 'rule-2',
            type: 'NotARuleType',
            name: 'Почасовая',
            targetRole: 'ONLINE_MANAGER',
            config: {},
            direction: 'shop',
            motivationSchemaName: 'Менеджеры',
        });

        expect(result.success).toBe(false);
    });
});
