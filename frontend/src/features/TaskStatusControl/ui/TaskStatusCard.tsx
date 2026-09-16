import { BadgeCheck, BadgeX, Calendar, Pencil, X } from 'lucide-react'
import type {
    SalaryAccrualLineSummary,
    SalaryRuleSummary,
    Task,
    TaskComment,
    TaskDirection,
    TaskLink,
    TaskStatus,
} from 'ireports-contracts'

import { Avatar, AvatarFallback } from '@/shared/ui-kit/atoms/Avatar.tsx'
import { IconButton } from '@/shared/ui-kit/atoms/IconButton.tsx'
import { TaskStatusBadge } from '@/shared/ui-kit/atoms/TaskStatusBadge.tsx'
import { cn } from '@/shared/lib/tw'

import { EditTaskFields, type EditTaskFieldsProps } from './EditTaskFields.tsx'
import { SalaryRuleSummaryBlock } from './SalaryRuleSummaryBlock.tsx'
import { SECTION_LABEL_CLASS } from './sectionLabel.ts'
import { TaskCommentsSection } from './TaskCommentsSection.tsx'
import { TaskLinksSection } from './TaskLinksSection.tsx'
import { TaskTransitionActions } from './TaskTransitionActions.tsx'

/**
 * Pencil `Q7v9pt` (`Панель · Детализация задачи`) — карточка перестроена на секции-панели: каждый
 * блок («Описание», «Параметры», «Действия», «Зарплатное правило», «Ссылки», «Комментарии») — это
 * `border-t` + одинаковый паддинг [14,20] на всю ширину, а не единая колонка с ручными
 * разделителями `h-px`.
 *
 * Заголовок (`W3HjOw`) — `sticky top-0` внутри `SidePanel`'s единственного `overflow-y-auto`-
 * контейнера: `top`-стики не имеет проблемы "контент короче панели" (элемент и так уже в начале
 * потока, `sticky` тут не более чем no-op при коротком контенте, а прилипает при прокрутке длинного).
 * Поле комментария (`SuDZe`) сюда не входит вовсе — не `position: sticky` внутри карточки (у
 * "прилипания" снизу как раз есть та проблема с коротким контентом: нечего скроллить — не к чему
 * прилипать), а `SidePanel`'s собственный `footer`-слот, который `TaskDetailsPanel` заполняет
 * `TaskCommentComposerContainer` — см. её JSDoc.
 *
 * `Task` не хранит "разовая/регулярная" — это атрибут `SalaryRule`, не задачи (design.md решение 2),
 * поэтому подзаголовок ("Разовая задача · дедлайн 24.09.2026" в тексте макета) не воспроизводит
 * "разовая задача" — этих данных здесь по конструкции нет.
 */
const DIRECTION_LABEL: Record<TaskDirection, string> = {
    service: 'Сервис',
    shop: 'Шоп',
}

// Цветная точка перед заголовком (`st88O` в макете) — визуальное эхо тона статус-бейджа
// (`TaskStatusBadge`), не отдельная семантика: каждому статусу сопоставлен его "сильный" оттенок
// из уже существующих токенов (тот же, что используют бейдж/чип этого статуса в остальном
// приложении — REWORK/violet-ink, CLOSED_SUCCESSFULLY/brand-strong и т.д.).
const STATUS_DOT_CLASS: Record<TaskStatus, string> = {
    NEW: 'bg-ink-faint',
    IN_PROGRESS: 'bg-info-ink',
    DONE: 'bg-warn',
    CLOSED_SUCCESSFULLY: 'bg-brand-strong',
    CLOSED_UNSUCCESSFULLY: 'bg-danger',
    REWORK: 'bg-violet-ink',
}

// `Task.deadline` — тип `Date` в ireports-contracts (`z.coerce.date()` в схеме ответа), но фронт не
// прогоняет ответы API через эту схему — по факту это ISO-строка из JSON, не `Date` (тот же случай,
// что `transaction.occurredAt` в `TransactionsLedger.tsx`), поэтому оборачиваем в `new Date(...)`.
function formatDeadline(deadline: Date | string): string {
    return new Date(deadline).toLocaleDateString('ru-RU', { day: '2-digit', month: '2-digit', year: 'numeric' })
}

function initialsOf(name: string): string {
    const parts = name.trim().split(/\s+/)
    return parts
        .slice(0, 2)
        .map((p) => p[0]?.toUpperCase())
        .join('')
}

const TERMINAL_NOTE: Partial<Record<TaskStatus, { text: string; tone: 'brand' | 'danger' }>> = {
    CLOSED_SUCCESSFULLY: {
        text: 'Задача закрыта успешно — начисление по связанному правилу доступно',
        tone: 'brand',
    },
    CLOSED_UNSUCCESSFULLY: {
        text: 'Задача закрыта неуспешно — начисление по связанному правилу недоступно',
        tone: 'danger',
    },
}

export type TaskStatusCardProps = {
    task: Task
    assigneeName?: string
    isTransitionPending?: boolean
    onTransition: (targetStatus: TaskStatus) => void
    onClose?: () => void
    className?: string
    // edit-task, tasks.md группа 8 (design.md Decision 5) — режим редактирования карточки.
    // `editFieldsProps` — `null` вне режима редактирования (карточка сама не знает про
    // `useEditTaskForm`, только рендерит то, что ей передал `TaskStatusControl`).
    isEditing: boolean
    onToggleEdit: () => void
    editFieldsProps: EditTaskFieldsProps | null
    comments: TaskComment[]
    links: TaskLink[]
    onAddLink: (url: string, label?: string) => void
    onRemoveLink: (linkId: string) => void
    salaryRuleSummary: SalaryRuleSummary | null
    salaryAccrual: SalaryAccrualLineSummary | null
    salaryRuleDirection: TaskDirection | null
    onOpenSalaryRule?: (args: { ruleId: string; direction: TaskDirection }) => void
}

export function TaskStatusCard({
    task,
    assigneeName,
    isTransitionPending = false,
    onTransition,
    onClose,
    className,
    comments,
    links,
    onAddLink,
    onRemoveLink,
    salaryRuleSummary,
    salaryAccrual,
    salaryRuleDirection,
    onOpenSalaryRule,
    isEditing,
    onToggleEdit,
    editFieldsProps,
}: TaskStatusCardProps) {
    const assigneeLabel = assigneeName ?? `Сотрудник #${task.assigneeEmployeeId}`
    const terminalNote = TERMINAL_NOTE[task.status]

    return (
        <div data-slot="task-status-card" className={cn('flex w-full flex-col bg-surface md:w-[552px]', className)}>
            <div className="sticky top-0 z-10 flex shrink-0 items-start justify-between gap-3 border-b border-hairline bg-surface px-5 py-4">
                <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                        <span
                            aria-hidden
                            className={cn('size-2 shrink-0 rounded-full', STATUS_DOT_CLASS[task.status])}
                        />
                        <h2 className="min-w-0 truncate font-display text-base font-semibold text-ink">
                            {task.title}
                        </h2>
                        <TaskStatusBadge status={task.status} />
                    </div>
                    <p className="mt-1.5 truncate font-ui text-xs text-ink-muted">
                        {task.direction ? `${DIRECTION_LABEL[task.direction]} · ` : ''}дедлайн{' '}
                        {formatDeadline(task.deadline)}
                    </p>
                </div>
                <div className="flex shrink-0 items-center gap-1.5">
                    {!terminalNote && (
                        <IconButton
                            aria-label="Редактировать задачу"
                            onClick={onToggleEdit}
                            className="shrink-0 bg-canvas hover:bg-canvas"
                        >
                            <Pencil />
                        </IconButton>
                    )}
                    {onClose && (
                        <IconButton
                            aria-label="Закрыть карточку задачи"
                            onClick={onClose}
                            className="shrink-0 bg-canvas hover:bg-canvas"
                        >
                            <X />
                        </IconButton>
                    )}
                </div>
            </div>

            {isEditing && editFieldsProps ? (
                <div className="px-5 py-3.5">
                    <EditTaskFields {...editFieldsProps} />
                </div>
            ) : (
                <>
                    <div className="px-5 py-3.5">
                        <p className={SECTION_LABEL_CLASS}>Описание</p>
                        <p className="mt-2 font-ui text-sm leading-relaxed text-ink">
                            {task.description || 'Без описания'}
                        </p>
                    </div>

                    <div className="flex gap-6 border-t border-hairline px-5 py-3.5">
                        <div className="min-w-0 flex-1">
                            <p className={SECTION_LABEL_CLASS}>Дедлайн</p>
                            <div className="mt-2 flex items-center gap-1.5">
                                <Calendar className="size-[13px] shrink-0 text-ink-muted" />
                                <span className="font-ui text-[13px] font-semibold text-ink">
                                    {formatDeadline(task.deadline)}
                                </span>
                            </div>
                        </div>
                        <div className="min-w-0 flex-1">
                            <p className={SECTION_LABEL_CLASS}>Ответственный</p>
                            <div className="mt-2 flex items-center gap-2">
                                <Avatar size="sm">
                                    <AvatarFallback>{initialsOf(assigneeLabel)}</AvatarFallback>
                                </Avatar>
                                <span className="truncate font-ui text-sm text-ink">{assigneeLabel}</span>
                            </div>
                        </div>
                    </div>
                </>
            )}

            <div className={cn('border-t border-hairline px-5 py-3.5', !terminalNote && 'bg-canvas')}>
                {terminalNote ? (
                    <div
                        className={cn(
                            'flex items-center gap-2.5 rounded-lg p-3.5',
                            terminalNote.tone === 'brand' ? 'bg-brand-soft text-ok-ink' : 'bg-danger-soft text-danger',
                        )}
                    >
                        {terminalNote.tone === 'brand' ? (
                            <BadgeCheck className="size-[18px] shrink-0" />
                        ) : (
                            <BadgeX className="size-[18px] shrink-0" />
                        )}
                        <p className="font-ui text-xs leading-snug font-medium">{terminalNote.text}</p>
                    </div>
                ) : (
                    <TaskTransitionActions
                        status={task.status}
                        onTransition={onTransition}
                        isPending={isTransitionPending}
                    />
                )}
            </div>

            {salaryRuleSummary && (
                <div className="flex flex-col gap-2.5 border-t border-hairline px-5 py-3.5">
                    <p className={SECTION_LABEL_CLASS}>Зарплатное правило</p>
                    <SalaryRuleSummaryBlock
                        summary={salaryRuleSummary}
                        accrual={salaryAccrual}
                        direction={salaryRuleDirection ?? task.direction ?? 'service'}
                        onOpen={onOpenSalaryRule}
                    />
                    {!salaryAccrual && (
                        <p className="font-ui text-[11.5px] text-ink-muted">
                            Начисление появится после того, как задачу закроют успешно и оно попадёт в отчёт
                            сотрудника.
                        </p>
                    )}
                </div>
            )}

            <div className="border-t border-hairline px-5 py-3.5">
                <TaskLinksSection links={links} onAddLink={onAddLink} onRemoveLink={onRemoveLink} />
            </div>

            <div className="border-t border-hairline px-5 py-3.5">
                <TaskCommentsSection comments={comments} />
            </div>
        </div>
    )
}
