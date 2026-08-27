import { buildPercentBorders, parseNumber, type RuleFieldErrors } from './formNumberUtils.ts'
import type { RuleDraft } from './ruleDraft.ts'

/**
 * Сборщики `config`/`config.award` по типу правила — вынесены из `service/model/ruleFormSchema.ts`
 * в ядро, чтобы оба резолвера обращались к ним как к общему коду, а не одно направление к
 * внутренностям другого. Чистое построение plain-JS-объекта из строк черновика: ни один из них не
 * знает ни про `salaryRuleRequestSchema`, ни про `shopSalaryRuleRequestSchema` — финальный
 * `safeParse` делает сам резолвер направления (`service/model/ruleFormSchema.ts` /
 * `shop/model/ruleFormSchema.ts`), поэтому переиспользуются магазином без смешивания контрактов
 * (см. комментарии над `buildOrderPayedAward`/`buildTaskCompletedConfig`).
 */

export function buildServiceCompletedAward(draft: RuleDraft, errors: RuleFieldErrors): unknown {
    switch (draft.awardKind) {
        case 'Fixed': {
            const price = parseNumber(draft.price)
            if (price === undefined) errors.price = 'Укажите сумму'
            return { type: 'Fixed', price: price ?? Number.NaN }
        }
        case 'ServiceFixed':
            return { type: 'ServiceFixed' }
        case 'ServicePercent': {
            const percent = parseNumber(draft.percent)
            if (percent === undefined) errors.percent = 'Укажите процент'
            return { type: 'ServicePercent', percent: percent ?? Number.NaN }
        }
        default:
            errors.awardKind = 'Выберите вариант награды'
            return { type: 'Fixed', price: Number.NaN }
    }
}

/**
 * Shared (Фаза 4) — `shop/model/ruleFormSchema.ts`'s `resolveShopRuleDraft` reuses this verbatim
 * for `ProductSold`'s award: `productSoldSalaryConfigSchema.award` (`shop-salary-rule.ts`) is the exact
 * same 3-variant shape (`Fixed`/`FixedPercent`/`FloatPercent`, same field names) as
 * `orderPayedSalaryConfigSchema.award` here — this function only builds a plain JS object from the
 * draft's strings, it has no dependency on `salaryRuleRequestSchema`, so reusing it does not mix the
 * two directions' contracts (each resolver still `safeParse`s the built object against its own
 * schema separately, see `formNumberUtils.ts`'s file comment).
 */
export function buildOrderPayedAward(draft: RuleDraft, errors: RuleFieldErrors): unknown {
    switch (draft.awardKind) {
        case 'Fixed': {
            const price = parseNumber(draft.price)
            if (price === undefined) errors.price = 'Укажите сумму'
            return { type: 'Fixed', price: price ?? Number.NaN }
        }
        case 'FixedPercent': {
            const percent = parseNumber(draft.percent)
            if (percent === undefined) errors.percent = 'Укажите процент'
            if (!draft.salaryBasis) errors.salaryBasis = 'Выберите базу начисления'
            return { type: 'FixedPercent', percent: percent ?? Number.NaN, salaryBasis: draft.salaryBasis || 'REVENUE' }
        }
        case 'FloatPercent': {
            const basePercent = parseNumber(draft.basePercent)
            if (basePercent === undefined) errors.basePercent = 'Укажите базовый процент'
            if (!draft.salaryBasis) errors.salaryBasis = 'Выберите базу начисления'
            const percentBorders = buildPercentBorders(draft.percentBorders, errors)
            return {
                type: 'FloatPercent',
                basePercent: basePercent ?? Number.NaN,
                salaryBasis: draft.salaryBasis || 'REVENUE',
                percentBorders,
            }
        }
        default:
            errors.awardKind = 'Выберите вариант награды'
            return { type: 'Fixed', price: Number.NaN }
    }
}

/**
 * Границы дедлайна правила-задачи (`YYYY-MM-DD`), вычисленные из выбранного расчётного месяца
 * `period` (`YYYY-MM`) — те же границы `[первое число, последнее число]`, что проверяет
 * `taskCompletedSalaryConfigSchema`'s `.superRefine` на бэкенде (`contracts/commands/salary-rule.ts`,
 * design.md Decision 9). Используется и как `min`/`max` нативного `<input type="date">`
 * (`ui/RuleFormCard/ui/TaskCompletedFields.tsx`), и в `buildTaskCompletedConfig` ниже — тот же
 * приём "дублировать литеральный паттерн, не импортировать zod-схему рантаймом", что и у
 * `PeriodPicker`'s `isValidPeriod` (см. этот компонент про Vite ESM interop с `ireports-contracts`).
 * Пустой `period` (ещё не выбран/некорректный формат) даёт пустые границы — `<input>` без `min`/`max`
 * ведёт себя как обычное поле даты, а `buildTaskCompletedConfig` в этом случае уже отдельно требует
 * `period`.
 */
export function taskCompletedDueDateBounds(period: string): { min: string; max: string } {
    if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(period)) return { min: '', max: '' }
    const [year, month] = period.split('-').map(Number)
    const lastDay = new Date(year, month, 0).getDate()
    return { min: `${period}-01`, max: `${period}-${String(lastDay).padStart(2, '0')}` }
}

/**
 * `TaskCompleted.config` целиком (не только `award` — контракт этого типа больше не содержит
 * award-union, change salary-rule-bitrix-task, design.md Decision 2) — единственный вид
 * вознаграждения теперь фиксированная сумма, поэтому здесь нет `awardKind`-переключателя, как и у
 * `PayPerHour`'s единственного поля ставки (`draft.price` переиспользован под `rewardAmount`, та же
 * конвенция, что описана в `ruleDraft.ts`'s комментарии к полю `price`). `bitrixTaskIds`/
 * `actualAmounts` не заполняются клиентом (сервер проставляет их сам после `createTask` — design.md
 * Decision 1/2), поэтому в возвращаемом объекте их нет вовсе, а не `[]`/`undefined`.
 */
export function buildTaskCompletedConfig(draft: RuleDraft, errors: RuleFieldErrors): unknown {
    if (draft.description.trim().length === 0) errors.description = 'Укажите описание задачи'
    if (!draft.period) errors.period = 'Укажите расчётный месяц'

    const rewardAmount = parseNumber(draft.price)
    if (rewardAmount === undefined) errors.price = 'Укажите сумму вознаграждения'

    if (!draft.dueDate) {
        errors.dueDate = 'Укажите дедлайн'
    } else if (draft.period) {
        const bounds = taskCompletedDueDateBounds(draft.period)
        if (bounds.min && (draft.dueDate < bounds.min || draft.dueDate > bounds.max)) {
            errors.dueDate = 'Дедлайн должен находиться в пределах выбранного расчётного месяца'
        }
    }

    return {
        description: draft.description.trim(),
        period: draft.period,
        isRecurring: draft.isRecurring,
        dueDate: draft.dueDate,
        rewardAmount: rewardAmount ?? Number.NaN,
    }
}
