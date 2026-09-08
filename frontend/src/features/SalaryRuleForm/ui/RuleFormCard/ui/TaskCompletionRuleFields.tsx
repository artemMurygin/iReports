import { ExternalLink } from 'lucide-react'

import { Input } from '@/shared/ui-kit/atoms/Input'
import { SegmentedControl, type SegmentedControlOption } from '@/shared/ui-kit/atoms/SegmentedControl'
import { Textarea } from '@/shared/ui-kit/atoms/Textarea'

import type { RuleFieldErrors } from '../../../model/formNumberUtils.ts'
import type { RuleDraft } from '../../../model/ruleDraft.ts'

import { AmountField } from './AmountField.tsx'
import { FieldError } from './FieldError.tsx'

export type TaskCompletionRuleFieldsProps = {
    draft: RuleDraft
    /** `errors.taskId`/`errors.taskTitleTemplate`/`errors.dueDate`/`errors.price` — see each
     * field's own comment below for when `resolveRuleDraft` actually sets it. */
    errors: RuleFieldErrors
    onChange: (patch: Partial<RuleDraft>) => void
}

type PeriodTab = 'once' | 'recurring'

/** Node `Ri64J` (`Period Tabs`, фрейм `EdCuh`) — тот же переиспользуемый `SegmentedControl`, что и
 * `SalaryBasisField`. Третий пункт «Сотрудники» показан в макете выключенным — то же продуктовое
 * решение, что и раньше (правило TaskCompletion заводится только на личную схему сотрудника, см.
 * `TaskCompletionRequiresPersonalSchemaException`), поэтому пункт не заведён в коде вовсе. */
const PERIOD_TABS: SegmentedControlOption<PeriodTab>[] = [
    { value: 'once', label: 'Разовая' },
    { value: 'recurring', label: 'Регулярная' },
]

/**
 * Pencil: `design/sallary-first-iteration.pen`, фрейм `EdCuh` («Создание правила «За выполнение
 * задачи» · Шаг 2, Регулярная») → «Колонка · Правило» → «Карточка · Правило» → `Body` — тело
 * карточки правила `TaskCompletion` (tasks.md раздел 14.5), рендерится вместо `AwardSection`
 * через `config.taskRuleTypes`/`showTaskFields` (`useRuleFormCard.ts`).
 *
 * replace-bitrix-task-integration, design.md решения 2/4 — переписано относительно прежней
 * (Bitrix-эры) версии этого файла: задача больше не заводится этой формой (ни явно текстовым
 * полем, ни неявно из `draft.name`) — она уже существует к моменту, когда эта карточка вообще
 * видна (`draft.taskId`, заполняется ТОЛЬКО Шагом 1 мастера `CreateTaskCompletionRuleWizard`,
 * `pages/SalaryRuleDetail/mediator`). Поэтому:
 * - «Задача» здесь — readonly-виджет с самим `taskId` (узел `vLb8m` в макете показывает куда
 *   более богатую карточку — заголовок/статус/дедлайн/ответственный самой задачи — но эти данные
 *   черновик правила не хранит и не обязан загружать: они приходят из отдельного модуля `tasks`
 *   через `features/TaskStatusControl`, которую `features/SalaryRuleForm` не может импортировать
 *   напрямую, — кросс-фичевый импорт запрещён, frontend/CLAUDE.md). Богатую карточку с реальными
 *   title/статусом/дедлайном рисует сам мастер на Шаге 2 (он вправе импортировать обе фичи) — эта
 *   readonly-строка отвечает только за то, что здесь принципиально можно показать без похода в
 *   другой модуль: сам факт "задача #id уже привязана" плюс ссылка в общий раздел `/tasks`.
 * - `taskTitleTemplate`/`taskDescriptionTemplate`/`deadlineTemplate` — самостоятельные поля
 *   ШАБЛОНА для авто-пересоздания задачи РЕГУЛЯРНОГО правила на новый период
 *   (`EnsureRuleTaskForPeriodService`), не поля самой первой задачи (та уже создана на Шаге 1 со
 *   своими произвольными title/description/deadline) — поэтому видимы только при
 *   `isRecurring === true` (узел `YrCno`, «Блок · Шаблон для нового периода», в макете отсутствует
 *   в варианте «Разовая»).
 */
export function TaskCompletionRuleFields({ draft, errors, onChange }: TaskCompletionRuleFieldsProps) {
    const periodTab: PeriodTab = draft.isRecurring ? 'recurring' : 'once'

    return (
        <div className="flex flex-col gap-3.5">
            <div className="flex flex-col gap-1.5">
                <span className="font-ui text-xs font-medium text-ink-muted">Задача</span>
                <div className="flex items-center justify-between gap-3 rounded-[8px] border border-hairline bg-canvas px-3 py-2">
                    <span className="truncate font-ui text-[13px] font-medium text-ink">
                        {draft.taskId ? `Задача #${draft.taskId}` : 'Задача ещё не создана'}
                    </span>
                    <a
                        href="/tasks"
                        className="flex shrink-0 items-center gap-1 font-ui text-[12px] font-medium text-ink-muted hover:text-ink"
                    >
                        Открыть в разделе «Задачи»
                        <ExternalLink className="size-3.5" />
                    </a>
                </div>
                <FieldError message={errors.taskId} />
            </div>

            <div className="flex flex-col gap-1.5">
                <label className="font-ui text-xs font-medium text-ink-muted">Периодичность</label>
                <SegmentedControl
                    aria-label="Периодичность"
                    options={PERIOD_TABS}
                    value={periodTab}
                    onValueChange={(value) => onChange({ isRecurring: value === 'recurring' })}
                />
                <p className="font-ui text-[11px] text-ink-muted">
                    {draft.isRecurring
                        ? 'Регулярное правило автоматически получает новую задачу на каждый новый расчётный период'
                        : 'Задача заводится один раз и не пересоздаётся'}
                </p>
            </div>

            {draft.isRecurring && (
                <div className="flex flex-col gap-3.5 rounded-[8px] border border-hairline bg-canvas p-3">
                    <p className="font-ui text-xs font-semibold text-ink-muted">
                        Шаблон для автосоздания задачи на новый период
                    </p>

                    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                        <div className="flex flex-col gap-1.5">
                            <label className="font-ui text-xs font-medium text-ink-muted" htmlFor="task-title-template">
                                Заголовок задачи
                            </label>
                            <Input
                                id="task-title-template"
                                value={draft.taskTitleTemplate}
                                onChange={(event) => onChange({ taskTitleTemplate: event.target.value })}
                                placeholder="Например, Обновить фото витрины ({месяц})"
                            />
                            <FieldError message={errors.taskTitleTemplate} />
                        </div>

                        <div className="flex flex-col gap-1.5">
                            <label className="font-ui text-xs font-medium text-ink-muted" htmlFor="task-deadline-template">
                                Дедлайн шаблона
                            </label>
                            <Input
                                id="task-deadline-template"
                                type="date"
                                value={draft.deadlineTemplate.slice(0, 10)}
                                onChange={(event) => onChange({ deadlineTemplate: event.target.value })}
                            />
                            <p className="font-ui text-[11px] text-ink-muted">Число месяца — дедлайн каждого периода</p>
                            <FieldError message={errors.dueDate} />
                        </div>
                    </div>

                    <div className="flex flex-col gap-1.5">
                        <label className="font-ui text-xs font-medium text-ink-muted" htmlFor="task-description-template">
                            Описание задачи
                        </label>
                        <Textarea
                            id="task-description-template"
                            value={draft.taskDescriptionTemplate}
                            onChange={(event) => onChange({ taskDescriptionTemplate: event.target.value })}
                            placeholder="Необязательно — попадёт в описание каждой новой задачи периода"
                        />
                    </div>
                </div>
            )}

            {/* Сумма начисления по умолчанию — предзаполняет строку начисления, когда задача
                переходит в «Закрыта успешно» (TaskCompletion.calculate()); руководитель
                по-прежнему может изменить её и обязан указать комментарий при проведении
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
