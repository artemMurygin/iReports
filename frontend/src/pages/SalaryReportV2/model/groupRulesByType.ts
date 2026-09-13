import type { SalaryReportRule } from '@/features/SalaryReportData'

export type SplitRulesByType = {
    /** Правила за выполнение Bitrix-задачи (`rule.type === 'TaskCompletion'`) — бенто-карточка
     * «Источник · Задачи» объединяет их из ОБОИХ направлений сразу, в отличие от ролевых правил,
     * которые остаются разбитыми по карточкам направлений (см. новый дизайн, узел `YCxrT`
     * "Вариант C · Бенто-источники"). */
    taskRules: SalaryReportRule[]
    /** Все остальные правила направления (`PayPerHour`/`ServiceCompleted`/`OrderPayed`/
     * `DepartmentPercent`/… — обычные ролевые правила) — дальше группируются по роли через
     * `groupRulesByRole`, которая не меняется этим модулем. */
    roleRules: SalaryReportRule[]
}

/**
 * Делит правила направления на «задачные» (`TaskCompletion`) и «ролевые» (всё остальное) —
 * бенто-раскладка (Pencil `design/sallary-first-iteration.pen`, узел `YCxrT`) показывает их в
 * разных карточках: задачные — в одной общей карточке «Источник · Задачи» сразу по обоим
 * направлениям, ролевые — в карточках-источниках направления, сгруппированные по роли
 * (`groupRulesByRole`, эта функция её не заменяет и не переиспользует — та работает уже на
 * `roleRules` одного направления).
 */
export function splitRulesByType(rules: SalaryReportRule[]): SplitRulesByType {
    const taskRules: SalaryReportRule[] = []
    const roleRules: SalaryReportRule[] = []
    for (const rule of rules) {
        if (rule.type === 'TaskCompletion') taskRules.push(rule)
        else roleRules.push(rule)
    }
    return { taskRules, roleRules }
}
