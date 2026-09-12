import type { SalaryBasis, SalaryRuleDetail } from 'ireports-contracts'

import { formatCurrency } from '@/shared/lib/format.ts'

/**
 * add-task-salary-rule-links-comments, tasks.md группа 29 — построение списка `Spec Row` для
 * блока «Параметры правила» (`XiJo6`/`Nuezn`) из `SalaryRuleDetail.config`, которое различается
 * по `type` (discriminated union, `contracts/commands/salary-rule.ts`). Вынесено в отдельную
 * чистую функцию (не JSX) — тестируется через рендер `SalaryRuleSummaryCard`, но описывает
 * бизнес-незначащую (чисто отображательную) маппинг-логику отдельно от разметки.
 *
 * Панель открывается только для правил вида `TaskCompletion` (единственный тип, на который может
 * ссылаться задача — `SalaryRuleRepositoryPort.findByTaskId` фильтрует по нему, design.md решение
 * 4): Вознаграждение/Периодичность/Дедлайн. Остальные три типа обрабатываются здесь для полноты
 * (`GetSalaryRuleService.execute` — универсальный «правило по id», не завязанный на задачу) без
 * отдельного макета под них.
 *
 * `deadline` показывается только для регулярного правила (`isRecurring: true`) — `deadlineTemplate`
 * содержательно используется ТОЛЬКО для пересоздания задачи на новый период (см. WHY у
 * `TaskCompletionSalaryConfigRequest.deadlineTemplate` в contracts/commands/salary-rule.ts); для
 * разового правила форма создания/редактирования правила (`TaskCompletionRuleFields.tsx`) вообще не
 * запрашивает и не валидирует это поле, поэтому оно в БД часто пустая строка — показывать такую
 * строку в панели значило бы рендерить бессмысленный пустой «Дедлайн» вместо того, чтобы скрыть его,
 * как уже делает сама форма.
 */
export type RuleParamRow = {
    key: string
    label: string
    value: string
    emphasize?: boolean
}

const SALARY_BASIS_GENITIVE: Record<SalaryBasis, string> = {
    REVENUE: 'выручки',
    MARGIN: 'маржи',
    SALARY_MINUS_ENGINEER_SALARY: 'суммы за вычетом зарплаты инженера',
}

function formatDayOfMonth(isoDate: string): string {
    const day = Number(isoDate.slice(8, 10))
    return Number.isFinite(day) && day > 0 ? `${day}-е число` : isoDate
}

export function getRuleParams(rule: SalaryRuleDetail): RuleParamRow[] {
    switch (rule.type) {
        case 'TaskCompletion': {
            const { config } = rule
            const rows: RuleParamRow[] = [
                {
                    key: 'amount',
                    label: 'Вознаграждение',
                    value: formatCurrency(config.defaultAmount),
                    emphasize: true,
                },
                {
                    key: 'recurrence',
                    label: 'Периодичность',
                    value: config.isRecurring ? 'Ежемесячно' : 'Разовая',
                },
            ]
            if (config.isRecurring) {
                rows.push({ key: 'deadline', label: 'Дедлайн', value: formatDayOfMonth(config.deadlineTemplate) })
            }
            return rows
        }
        case 'PayPerHour':
            return [{ key: 'price', label: 'Ставка, ₽/час', value: formatCurrency(rule.config.price), emphasize: true }]
        case 'ServiceCompleted': {
            const { award, orderTypeIds } = rule.config
            const rows: RuleParamRow[] = [awardRow(award)]
            if (orderTypeIds?.length) {
                rows.push({ key: 'order-types', label: 'Типы заказов', value: `${orderTypeIds.length}` })
            }
            return rows
        }
        case 'OrderPayed': {
            const { award, orderTypeIds } = rule.config
            const rows: RuleParamRow[] = [awardRow(award)]
            if (orderTypeIds?.length) {
                rows.push({ key: 'order-types', label: 'Типы заказов', value: `${orderTypeIds.length}` })
            }
            return rows
        }
        default:
            return []
    }
}

type AwardConfig =
    | { type: 'Fixed'; price: number }
    | { type: 'ServiceFixed' }
    | { type: 'ServicePercent'; percent: number }
    | { type: 'FixedPercent'; percent: number; salaryBasis: SalaryBasis }
    | { type: 'FloatPercent'; basePercent: number; salaryBasis: SalaryBasis }

function awardRow(award: AwardConfig): RuleParamRow {
    switch (award.type) {
        case 'Fixed':
            return { key: 'award', label: 'Сумма', value: formatCurrency(award.price), emphasize: true }
        case 'ServiceFixed':
            return { key: 'award', label: 'Вознаграждение', value: 'Ставка из справочника услуги' }
        case 'ServicePercent':
            return { key: 'award', label: 'Процент', value: `${award.percent}%` }
        case 'FixedPercent':
            return {
                key: 'award',
                label: 'Процент',
                value: `${award.percent}% от ${SALARY_BASIS_GENITIVE[award.salaryBasis]}`,
            }
        case 'FloatPercent':
            return {
                key: 'award',
                label: 'Базовый процент',
                value: `${award.basePercent}% от ${SALARY_BASIS_GENITIVE[award.salaryBasis]}`,
            }
    }
}
