import { withRequestContext } from '@/shared/testing/with-request-context';
import { ArgumentInvalidException } from '@/shared/exceptions';
import { BITRIX_TASK_STATUS_COMPLETED } from '@/integrations/bitrix/schema';
import { TaskStatus } from './task-status.value-object';

// Раздел 9 tasks.md (add-task-based-salary-rule): TaskStatus VO оборачивает
// сырой код статуса задачи Bitrix24 (tasks.task.get) — SalaryTask.taskStatus
// (Prisma-модель, задача 1.1). isDone() true ТОЛЬКО для кода "Завершена"
// (STATUS = 5, src/integrations/bitrix/schema.ts —
// BITRIX_TASK_STATUS_COMPLETED, уже подтверждено разделом 5/8 tasks.md и
// повторно свёрено через mcp__claude_ai_Bitrix_24__bitrix-method-details
// при подготовке этого раздела: точного перечня числовых кодов статусов в
// документации метода нет, официальный "Завершена" = 5 остаётся
// неподтверждённым буквальным перечислением на портале — риск зафиксирован
// как открытый вопрос в отчёте задачи 9, тот же, что уже отмечен в разделе 5).
describe('TaskStatus', () => {
    describe('fromRaw', () => {
        it('оборачивает непустой код статуса', () => {
            const status = TaskStatus.fromRaw('2');
            expect(status.code).toBe('2');
        });

        it('выбрасывает ArgumentInvalidException для пустой строки', () => {
            withRequestContext(() => {
                expect(() => TaskStatus.fromRaw('')).toThrow(
                    ArgumentInvalidException,
                );
            });
        });
    });

    describe('isDone', () => {
        it('true для кода "Завершена" (BITRIX_TASK_STATUS_COMPLETED)', () => {
            const status = TaskStatus.fromRaw(
                String(BITRIX_TASK_STATUS_COMPLETED),
            );
            expect(status.isDone()).toBe(true);
        });

        it('false для кода "Новая" (2)', () => {
            expect(TaskStatus.fromRaw('2').isDone()).toBe(false);
        });

        it('false для кода "Выполняется" (3)', () => {
            expect(TaskStatus.fromRaw('3').isDone()).toBe(false);
        });

        it('false для произвольного нечислового/незнакомого кода — не совпадает буквально с кодом "Завершена"', () => {
            expect(TaskStatus.fromRaw('UNKNOWN').isDone()).toBe(false);
        });
    });
});
