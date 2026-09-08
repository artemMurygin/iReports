import { Period } from '@/shared/domain/period.value-object';
import { computeRecurringTaskDeadline } from './task-deadline';

// Раздел 16 tasks.md (add-task-based-salary-rule) — тест ДО реализации
// (TDD, см. WHY во вводном комментарии tasks.md). Правило task 11.1/16.1:
// "для регулярного (isRecurring: true) — вычисляет deadline нового периода
// из deadlineTemplate (число месяца)". deadlineTemplate — ISO-дата, для
// регулярного правила используется только число месяца (день) — остальное
// (год/месяц) берётся из period, время суток переносится буквально.
describe('computeRecurringTaskDeadline', () => {
    it('берёт день месяца из deadlineTemplate, год/месяц — из period', () => {
        const period = Period.create('2026-10');
        const deadlineTemplate = '2026-01-25T18:00:00.000Z';

        const deadline = computeRecurringTaskDeadline(period, deadlineTemplate);

        expect(deadline.toISOString()).toBe('2026-10-25T18:00:00.000Z');
    });

    it('переносит время суток deadlineTemplate буквально', () => {
        const period = Period.create('2027-03');
        const deadlineTemplate = '2020-05-03T09:30:15.500Z';

        const deadline = computeRecurringTaskDeadline(period, deadlineTemplate);

        expect(deadline.toISOString()).toBe('2027-03-03T09:30:15.500Z');
    });

    it('день месяца, отсутствующий в целевом месяце, зажимается его длиной (не переносится на следующий месяц)', () => {
        const period = Period.create('2026-02'); // 28 дней
        const deadlineTemplate = '2026-01-31T00:00:00.000Z';

        const deadline = computeRecurringTaskDeadline(period, deadlineTemplate);

        expect(deadline.toISOString()).toBe('2026-02-28T00:00:00.000Z');
    });
});
