import { Period } from '@/shared/domain/period.value-object';
import { computeRecurringTaskDeadline } from './task-deadline';

// Раздел 16 tasks.md (add-task-based-salary-rule) — тест ДО реализации
// (TDD, см. WHY во вводном комментарии tasks.md). Правило task 11.1/16.1:
// "для регулярного (isRecurring: true) — вычисляет deadline нового периода
// из deadlineTemplate (число месяца)". deadlineTemplate — ISO-дата, для
// регулярного правила используется только число месяца (день) — остальное
// (год/месяц) берётся из period, время суток переносится буквально.
//
// recurring-task-deadline-offset, tasks.md раздел 6 (зеркало раздела 3
// направления service) — добавлен параметр deadlinePeriodOffset: год/месяц
// и длина месяца для зажатия дня теперь берутся из
// period.shiftMonths(deadlinePeriodOffset), а не всегда из самого period.
// Сценарии — openspec/changes/recurring-task-deadline-offset/specs/shop/accounting/spec.md.
describe('computeRecurringTaskDeadline', () => {
    it('берёт день месяца из deadlineTemplate, год/месяц — из period при смещении 0', () => {
        const period = Period.create('2026-10');
        const deadlineTemplate = '2026-01-25T18:00:00.000Z';

        const deadline = computeRecurringTaskDeadline(
            period,
            deadlineTemplate,
            0,
        );

        expect(deadline.toISOString()).toBe('2026-10-25T18:00:00.000Z');
    });

    it('переносит время суток deadlineTemplate буквально', () => {
        const period = Period.create('2027-03');
        const deadlineTemplate = '2020-05-03T09:30:15.500Z';

        const deadline = computeRecurringTaskDeadline(
            period,
            deadlineTemplate,
            0,
        );

        expect(deadline.toISOString()).toBe('2027-03-03T09:30:15.500Z');
    });

    it('день месяца, отсутствующий в целевом месяце, зажимается его длиной при смещении 0 (не переносится на следующий месяц)', () => {
        const period = Period.create('2026-02'); // 28 дней
        const deadlineTemplate = '2026-01-31T00:00:00.000Z';

        const deadline = computeRecurringTaskDeadline(
            period,
            deadlineTemplate,
            0,
        );

        expect(deadline.toISOString()).toBe('2026-02-28T00:00:00.000Z');
    });

    // spec: Сценарий "Положительное смещение — дедлайн после окончания периода"
    it('смещение 1 — дедлайн переносится в следующий месяц после периода', () => {
        const period = Period.create('2026-01');
        const deadlineTemplate = '2020-01-05T00:00:00.000Z';

        const deadline = computeRecurringTaskDeadline(
            period,
            deadlineTemplate,
            1,
        );

        expect(deadline.toISOString()).toBe('2026-02-05T00:00:00.000Z');
    });

    // spec: Сценарий "Число месяца зажимается длиной итогового месяца дедлайна"
    it('число месяца 31 со смещением 1 из января зажимается концом февраля, а не переносится в март', () => {
        const period = Period.create('2026-01');
        const deadlineTemplate = '2020-01-31T00:00:00.000Z';

        const deadline = computeRecurringTaskDeadline(
            period,
            deadlineTemplate,
            1,
        );

        expect(deadline.toISOString()).toBe('2026-02-28T00:00:00.000Z');
    });

    it('смещение через границу года переносит год дедлайна', () => {
        const period = Period.create('2026-12');
        const deadlineTemplate = '2020-01-10T00:00:00.000Z';

        const deadline = computeRecurringTaskDeadline(
            period,
            deadlineTemplate,
            1,
        );

        expect(deadline.toISOString()).toBe('2027-01-10T00:00:00.000Z');
    });
});
