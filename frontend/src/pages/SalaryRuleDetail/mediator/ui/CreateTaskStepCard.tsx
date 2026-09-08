import { CreateTaskForm } from '@/features/CreateTask'
import { Button } from '@/shared/ui-kit/atoms/Button'

export type CreateTaskStepCardProps = {
    /** `CreateTaskForm`'s `onCreated` — вызывается с `id` только что созданной задачи. */
    onCreated: (taskId: string) => void
    /** Тот же `onCancel`, что закрывает/удаляет обычную нераскрытую карточку правила
     * (`ruleFormProps.onCancel`, см. `core/model/useSalaryRulesDraft.ts`) — на Шаге 1 задача ещё
     * не создана, отменить нечего кроме самого черновика правила. */
    onCancel: () => void
    className?: string
}

/**
 * Pencil: `design/sallary-first-iteration.pen`, фрейм `FwNov` («Создание правила «За выполнение
 * задачи» · Шаг 1») → «Колонка · Правило» — Шаг 1 мастера (tasks.md раздел 14.3): эта карточка
 * оборачивает уже готовую `CreateTaskForm` (`features/CreateTask`, раздел 11 tasks.md) — задача
 * заголовок/описание/дедлайн/ответственный уже полностью реализованы там (её собственные
 * doc-комментарии уже называют себя "Шаг 1 мастера"), здесь только шапка ("ШАГ 1 ИЗ 2") и «Отмена».
 *
 * Отклонение от макета (осознанное, см. `pages/SalaryRuleDetail/mediator/CreateTaskCompletionRuleWizard.tsx`'s
 * комментарий): поле «Направление» из `FwNov` (node `ppnLs`) не заведено — `CreateTaskForm` не
 * принимает `direction` в текущем виде, а расширять готовую фичу ради необязательного (see
 * `contracts/commands/task.ts`'s `direction`, optional) тега вне бюджета этого прохода.
 */
export function CreateTaskStepCard({ onCreated, onCancel, className }: CreateTaskStepCardProps) {
    return (
        <div className={className}>
            <div className="flex w-full flex-col gap-3.5">
                <div className="flex flex-col gap-1">
                    <span className="font-ui text-[10px] font-semibold tracking-[0.8px] text-ink-muted">
                        НОВОЕ ПРАВИЛО · ЗА ВЫПОЛНЕНИЕ ЗАДАЧИ · ШАГ 1 ИЗ 2
                    </span>
                    <h2 className="font-display text-[17px] font-bold text-ink">Сначала создайте задачу</h2>
                    <p className="font-ui text-xs text-ink-muted">
                        Задача заводится отдельным действием — на втором шаге вы создадите правило и укажете эту уже
                        существующую задачу
                    </p>
                </div>

                <div className="flex w-full flex-col gap-3.5 rounded-[10px] border border-brand-border bg-surface p-3.5">
                    <CreateTaskForm onCreated={onCreated} submitLabel="Далее: правило" />

                    <div className="h-px w-full bg-hairline" />

                    <div className="flex items-center justify-between gap-3">
                        <p className="font-ui text-[11px] text-ink-muted">
                            Задача создаётся отдельным запросом POST /v1/tasks
                        </p>
                        <Button type="button" variant="secondary" onClick={onCancel}>
                            Отмена
                        </Button>
                    </div>
                </div>
            </div>
        </div>
    )
}
