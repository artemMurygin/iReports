import { Input } from '@/shared/ui-kit/atoms/Input'
import { SegmentedControl, type SegmentedControlOption } from '@/shared/ui-kit/atoms/SegmentedControl'
import { Textarea } from '@/shared/ui-kit/atoms/Textarea'

import type { RuleFieldErrors } from '../../../model/formNumberUtils.ts'
import { taskCompletedDueDateBounds } from '../../../model/ruleAwards.ts'
import type { RuleDraft } from '../../../model/ruleDraft.ts'

import { AmountField } from './AmountField.tsx'
import { FieldError } from './FieldError.tsx'

export type TaskCompletedFieldsProps = {
    draft: RuleDraft
    errors: RuleFieldErrors
    onChange: (patch: Partial<RuleDraft>) => void
}

type Recurrence = 'once' | 'recurring'

const RECURRENCE_OPTIONS: SegmentedControlOption<Recurrence>[] = [
    { value: 'once', label: 'Разовая' },
    { value: 'recurring', label: 'Регулярная' },
]

/**
 * Тело карточки правила `TaskCompleted` (change salary-rule-bitrix-task, spec.md "Создание правила
 * только в схеме на сотрудника"): описание, расчётный месяц, вид (разовая/регулярная), дедлайн,
 * сумма вознаграждения. Никакого выбора варианта награды здесь нет — контракт
 * (`taskCompletedSalaryConfigSchema`) поддерживает только фиксированную сумму (design.md
 * Decision 2, `FloatPercent` для этого типа удалён), поэтому, как и у `PayPerHour`'s одиночного
 * поля ставки, этот блок рендерится в `RuleFormCard.tsx` ВМЕСТО `AwardSection`, а не внутри него —
 * `config.awardOptionsByType.TaskCompleted` теперь пустой массив (`service/model/ruleTypes.ts` /
 * `shop/model/ruleTypes.ts`).
 *
 * Дедлайн — нативный `<input type="date">` с `min`/`max`, вычисленными из выбранного `period`
 * (`taskCompletedDueDateBounds`) — те же границы `[первое число, последнее число]`, что проверяет
 * `taskCompletedSalaryConfigSchema`'s `.superRefine` на бэкенде (design.md, Decision 9): некорректную
 * дату нельзя выбрать через нативный календарь пикера, а `buildTaskCompletedConfig` дополнительно
 * проверяет это же при сохранении (ручной ввод/вставка могут обойти `min`/`max` в некоторых
 * браузерах) — тот же приём "план + defence in depth", что и остальные резолверы этой формы.
 */
export function TaskCompletedFields({ draft, errors, onChange }: TaskCompletedFieldsProps) {
    const bounds = taskCompletedDueDateBounds(draft.period)

    return (
        <div className="flex flex-col gap-3.5">
            <div className="flex flex-col gap-1.5">
                <label className="font-ui text-xs font-medium text-ink-muted">Описание задачи</label>
                <Textarea
                    value={draft.description}
                    onChange={(event) => onChange({ description: event.target.value })}
                    placeholder="Что нужно сделать для выполнения задачи"
                />
                <FieldError message={errors.description} />
            </div>

            <div className="flex flex-col gap-3.5 sm:flex-row sm:items-start sm:gap-6">
                <div className="flex flex-col gap-1.5 sm:w-[220px]">
                    <label className="font-ui text-xs font-medium text-ink-muted">Расчётный месяц</label>
                    <Input type="month" value={draft.period} onChange={(event) => onChange({ period: event.target.value })} />
                    <FieldError message={errors.period} />
                </div>

                <div className="flex flex-col gap-1.5 sm:w-[220px]">
                    <label className="font-ui text-xs font-medium text-ink-muted">Дедлайн</label>
                    <Input
                        type="date"
                        value={draft.dueDate}
                        min={bounds.min || undefined}
                        max={bounds.max || undefined}
                        onChange={(event) => onChange({ dueDate: event.target.value })}
                    />
                    <FieldError message={errors.dueDate} />
                </div>
            </div>

            <div className="flex flex-col gap-1.5">
                <span className="font-ui text-xs font-medium text-ink-muted">Вид</span>
                <SegmentedControl
                    className="max-w-[280px]"
                    aria-label="Вид правила-задачи"
                    options={RECURRENCE_OPTIONS}
                    value={draft.isRecurring ? 'recurring' : 'once'}
                    onValueChange={(value) => onChange({ isRecurring: value === 'recurring' })}
                />
            </div>

            <AmountField
                label="Сумма вознаграждения, ₽"
                value={draft.price}
                placeholder="10000"
                error={errors.price}
                onValueChange={(price) => onChange({ price })}
            />
        </div>
    )
}
