import { Input } from '@/shared/ui-kit/atoms/Input'
import { SegmentedControl, type SegmentedControlOption } from '@/shared/ui-kit/atoms/SegmentedControl'
import { Textarea } from '@/shared/ui-kit/atoms/Textarea'

import type { RuleFieldErrors } from '../../../model/formNumberUtils.ts'
import type { RuleDraft } from '../../../model/ruleDraft.ts'

import { AmountField } from './AmountField.tsx'
import { FieldError } from './FieldError.tsx'

export type TaskCompletionRuleFieldsProps = {
    draft: RuleDraft
    /** `errors.dueDate`/`errors.price` — единственные поля этого блока, у которых вообще есть
     * валидация (`resolveRuleDraft`, `service/model/ruleFormSchema.ts`); `taskDescription`
     * необязателен, `isRecurring` всегда имеет значение по умолчанию. */
    errors: RuleFieldErrors
    onChange: (patch: Partial<RuleDraft>) => void
}

type PeriodTab = 'once' | 'recurring'

/** Node `sIV29`/`irJMj` (`Period Tabs`) — тот же переиспользуемый `SegmentedControl`, что и
 * `SalaryBasisField`. Макет (`wV3fv`/`aS8yc`) показывал третий, выключенный таб «Сотрудники» —
 * продуктовое решение (после add-task-based-salary-rule): правило TaskCompletion заводится только
 * на схему конкретного сотрудника (см. backend CreateSalaryRuleHandler/CreateShopSalaryRuleHandler,
 * `TaskCompletionRequiresPersonalSchemaException`), поэтому пункт убран из UI, а не просто оставлен
 * недоступным. */
const PERIOD_TABS: SegmentedControlOption<PeriodTab>[] = [
    { value: 'once', label: 'Разовая' },
    { value: 'recurring', label: 'Регулярная' },
]

/**
 * Pencil: `design/sallary-first-iteration.pen`, node `wV3fv` → `Task Block` (`berjy`) / `aS8yc` →
 * `Блок · Описание задачи` + `Блок · Периодичность` + `Блок · Сроки` — тело карточки правила
 * `TaskCompletion` (tasks.md раздел 20), рендерится вместо `AwardSection` через
 * `config.taskRuleTypes`/`showTaskFields` (`useRuleFormCard.ts`), тем же приёмом, что уже
 * применяется для `showCategory`/`showOrderTypeIds` (`RuleFormCardFields.tsx`).
 *
 * Поле «Название задачи (в Bitrix24)» из ui-design.md здесь не дублируется — по решению,
 * закреплённому прямо в `wV3fv` (node `u821y`'s hint «Из него формируется заголовок задачи в
 * Bitrix24»), заголовок Bitrix24-задачи строится из уже существующего поля «Название правила»
 * (`RuleFormCardFields.tsx`, тот же conditional-hint приём) — здесь заводить второе поле для того
 * же значения не нужно (`resolveRuleDraft`'s `bitrixTaskTitle: draft.name.trim()`).
 *
 * `deadlineTemplate` — ISO-дата (`YYYY-MM-DD`) хранится в драфте как есть; для разового правила
 * это буквально дедлайн задачи, для регулярного бэкенд читает только число месяца
 * (`ensure-salary-task-for-period.service.ts`) — фронт не обязан по-разному кодировать значение,
 * достаточно одного и того же `<input type="date">`, только подпись-подсказка меняется (ui-design.md:
 * «переключение таба уже часть переиспользуемого компонента; значение поля «Дедлайн» меняет только
 * текст, разметка не меняется»).
 *
 * Рамка также показывает «Расчётный месяц»/«Сумма начисления»/пояснение о ручном вводе и ссылку
 * «Задача в Bitrix24» — это view-only состояние уже СУЩЕСТВУЮЩЕГО правила с привязанной задачей
 * (не часть `taskCompletionSalaryConfigSchema`, не редактируется здесь) и не входит в буквальный
 * список полей этого пункта (`PM7Om`/`wQOPI`/паттерн `vm91M`/`DcWkE`) — оставлено для отдельной
 * задачи.
 *
 * `TaskStatusBadge` (tasks.md 23.1/23.2) сюда осознанно НЕ подключается: перечитан узел `nX14d`
 * («Шапка · Правило») фрейма `wV3fv` через `mcp__pencil__execute`/`Get` — в режиме редактирования
 * он показывает только заголовок правила и ссылку-кнопку «Открыть задачу в Bitrix24» (узел `RNTzC`,
 * `Задача #48307 в Bitrix24`), никакого статус-бейджа рядом с ней в макете нет. Бейдж подключён
 * только в отчёте (`RuleSourcesRail.tsx`, tasks.md 23.3) — по условию самой задачи 23.2: «если фрейм
 * статус не показывает — оставить бейдж только в отчёте, не изобретать размещение, не подтверждённое
 * макетом».
 */
export function TaskCompletionRuleFields({ draft, errors, onChange }: TaskCompletionRuleFieldsProps) {
    const periodTab: PeriodTab = draft.isRecurring ? 'recurring' : 'once'

    return (
        <div className="flex flex-col gap-3.5">
            <div className="flex flex-col gap-1.5">
                <label className="font-ui text-xs font-medium text-ink-muted">Описание задачи</label>
                <Textarea
                    value={draft.taskDescription}
                    onChange={(event) => onChange({ taskDescription: event.target.value })}
                    placeholder="Что нужно сделать — попадёт в задачу Bitrix24"
                />
                <p className="font-ui text-[11px] text-ink-muted">
                    Текст уходит в задачу Bitrix24 — обсуждение и файлы остаются там
                </p>
            </div>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div className="flex flex-col gap-1.5">
                    <label className="font-ui text-xs font-medium text-ink-muted">Периодичность</label>
                    <SegmentedControl
                        aria-label="Периодичность"
                        options={PERIOD_TABS}
                        value={periodTab}
                        onValueChange={(value) => onChange({ isRecurring: value === 'recurring' })}
                    />
                    <p className="font-ui text-[11px] text-ink-muted">
                        {draft.isRecurring ? 'Новая задача создаётся каждый месяц' : 'Задача заводится один раз'}
                    </p>
                </div>

                <div className="flex flex-col gap-1.5">
                    <label className="font-ui text-xs font-medium text-ink-muted">Дедлайн</label>
                    <Input
                        type="date"
                        value={draft.deadlineTemplate.slice(0, 10)}
                        onChange={(event) => onChange({ deadlineTemplate: event.target.value })}
                    />
                    <p className="font-ui text-[11px] text-ink-muted">
                        {draft.isRecurring ? 'Число месяца — дедлайн каждого периода' : 'Дедлайн единственной задачи'}
                    </p>
                    <FieldError message={errors.dueDate} />
                </div>
            </div>

            {/* Сумма начисления по умолчанию — предзаполняет строку начисления, когда задача
                переходит в «Выполнено» (TaskCompletion.calculate()); руководитель по-прежнему
                может изменить её и обязан указать комментарий при проведении
                (SetTaskRewardModal, `features/SalaryAccruals`). */}
            <AmountField
                label="Сумма начисления по умолчанию, ₽"
                value={draft.price}
                placeholder="5000"
                error={errors.price}
                onValueChange={(price) => onChange({ price })}
            />
        </div>
    )
}
