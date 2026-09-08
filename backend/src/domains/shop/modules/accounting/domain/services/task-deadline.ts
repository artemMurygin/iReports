import { Period } from '@/shared/domain/period.value-object';

// Раздел 16 tasks.md (add-task-based-salary-rule), design.md Decision 4 —
// зеркало computeDeadlineForPeriod направления service (раздел 11,
// application/services/salary-task/ensure-salary-task-for-period.service.ts,
// issue #57 — независимая копия, здесь не импортируется). Дедлайн новой
// задачи регулярного правила "за выполнение задачи" на очередной период:
// TaskCompletionShopSalaryConfig.deadlineTemplate — ISO-дата, из которой
// для регулярного правила используется ТОЛЬКО число месяца (день) —
// год/месяц берутся из целевого period, время суток переносится буквально
// из шаблона (см. комментарий у TaskCompletionShopSalaryConfig.deadlineTemplate
// в domain/types/salary-rule.types.ts, задача 15.3/2.1: "для разового
// правила берётся буквально, для регулярного используется только число
// месяца").
//
// День месяца зажимается длиной целевого месяца
// (Period.getTotalCalendarDays()), а не переносится в следующий месяц через
// overflow Date.UTC — иначе, например, deadlineTemplate "31 число" в
// феврале давал бы дедлайн в марте, а не последний день февраля (тот же
// приём и то же обоснование, что у зеркальной функции направления service).
export function computeRecurringTaskDeadline(
    period: Period,
    deadlineTemplate: string,
): Date {
    const template = new Date(deadlineTemplate);
    const { from } = period.getBounds();
    const totalDays = period.getTotalCalendarDays();
    const day = Math.min(template.getUTCDate(), totalDays);

    return new Date(
        Date.UTC(
            from.getUTCFullYear(),
            from.getUTCMonth(),
            day,
            template.getUTCHours(),
            template.getUTCMinutes(),
            template.getUTCSeconds(),
            template.getUTCMilliseconds(),
        ),
    );
}
