import { ChevronRight, Plus } from 'lucide-react'

import { Input } from '@/shared/ui-kit/atoms/Input'
import { SegmentedControl, type SegmentedControlOption } from '@/shared/ui-kit/atoms/SegmentedControl'
import { Textarea } from '@/shared/ui-kit/atoms/Textarea'

import { useRuleTask } from '../../../model/useRuleTask.ts'
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
    /** Opens the task details side panel for the already-linked task — see
     * `RuleFormCardContext.onOpenTask`'s comment (`../model/types.ts`). */
    onOpenTask?: (taskId: string) => void
    /** Opens the task creation side panel for this draft — see `RuleFormCardContext.onCreateTask`'s
     * comment (`../model/types.ts`). */
    onCreateTask?: (draftId: string) => void
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
 * полем, ни неявно из `draft.name`) — она заводится тут же, по клику "Создать задачу", в боковой
 * панели поверх этой карточки (`features/CreateTask`'s `CreateTaskPanel`, открывается через
 * `onCreateTask` — см. `useTaskLinkPanels.ts` за тем, откуда берётся сам колбэк и куда пишется
 * созданный `draft.taskId`). Поэтому:
 * - «Задача» здесь — либо кнопка "Создать задачу" (`draft.taskId === ''`), либо кликабельный
 *   виджет с названием уже привязанной задачи (`useRuleTask`, `GET /v1/tasks/:id` — собственный
 *   запрос этой фичи, не импорт `features/TaskStatusControl`, кросс-фичевый импорт запрещён,
 *   frontend/CLAUDE.md), открывающий по клику боковую панель с полной карточкой задачи
 *   (`features/TaskStatusControl`'s `TaskDetailsPanel`, через `onOpenTask`) — обе панели рендерит
 *   страница (`pages/SalaryRuleDetail`/`pages/SalaryRules`), которой обе фичи доступны.
 * - `taskTitleTemplate`/`taskDescriptionTemplate`/`deadlineTemplate` — самостоятельные поля
 *   ШАБЛОНА для авто-пересоздания задачи РЕГУЛЯРНОГО правила на новый период
 *   (`EnsureRuleTaskForPeriodService`), не поля самой первой задачи (та создаётся отдельно, со
 *   своими произвольными title/description/deadline, в панели выше) — поэтому видимы только при
 *   `isRecurring === true` (узел `YrCno`, «Блок · Шаблон для нового периода», в макете отсутствует
 *   в варианте «Разовая»).
 */
export function TaskCompletionRuleFields({
    draft,
    errors,
    onChange,
    onOpenTask,
    onCreateTask,
}: TaskCompletionRuleFieldsProps) {
    const periodTab: PeriodTab = draft.isRecurring ? 'recurring' : 'once'
    const task = useRuleTask(draft.taskId || null)

    return (
        <div className="flex flex-col gap-3.5">
            <div className="flex flex-col gap-1.5">
                <span className="font-ui text-xs font-medium text-ink-muted">Задача</span>
                {draft.taskId ? (
                    <button
                        type="button"
                        onClick={() => onOpenTask?.(draft.taskId)}
                        className="flex items-center justify-between gap-3 rounded-[8px] border border-hairline bg-canvas px-3 py-2 text-left transition-colors hover:bg-surface"
                    >
                        <span className="truncate font-ui text-[13px] font-medium text-ink">
                            {task.isLoading ? 'Загрузка…' : (task.data?.title ?? 'Задача')}
                        </span>
                        <ChevronRight className="size-3.5 shrink-0 text-ink-muted" />
                    </button>
                ) : (
                    <button
                        type="button"
                        onClick={() => onCreateTask?.(draft.draftId)}
                        className="flex items-center justify-center gap-1.5 rounded-[8px] border border-dashed border-hairline px-3 py-2 font-ui text-[13px] font-medium text-ink-muted transition-colors hover:border-brand-border hover:text-ink"
                    >
                        <Plus className="size-3.5" />
                        Создать задачу
                    </button>
                )}
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
                            <label
                                className="font-ui text-xs font-medium text-ink-muted"
                                htmlFor="task-deadline-template"
                            >
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
                        <label
                            className="font-ui text-xs font-medium text-ink-muted"
                            htmlFor="task-description-template"
                        >
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
