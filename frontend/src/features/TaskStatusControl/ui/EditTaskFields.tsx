import { useQuery } from '@tanstack/react-query'

import { Button } from '@/shared/ui-kit/atoms/Button.tsx'
import { Input } from '@/shared/ui-kit/atoms/Input.tsx'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/shared/ui-kit/atoms/Select.tsx'
import { Textarea } from '@/shared/ui-kit/atoms/Textarea.tsx'

import { tasksApi } from '../model/api.ts'

/**
 * edit-task, tasks.md группа 7 — форма draft'а редактирования задачи, отдаваемая
 * `useEditTaskForm` (другая параллельная задача той же группы). Формат совпадает с полями
 * `CreateTaskRequest`/`UpdateTaskRequest` (`title`/`description`/`deadline`/`assigneeEmployeeId`),
 * только `deadline` уже нормализован в `YYYY-MM-DD` (значение `<input type="date">`), не `Date`.
 */
export type TaskEditDraft = {
    title: string
    description: string
    deadline: string
    assigneeEmployeeId: number | null
}

export type EditTaskFieldsProps = {
    draft: TaskEditDraft
    onPatch: (partial: Partial<TaskEditDraft>) => void
    onSave: () => void
    onCancel: () => void
    canSave: boolean
    isPending: boolean
    error?: Error | null
}

/**
 * edit-task, tasks.md группа 7 — визуальная копия разметки `features/CreateTask/ui/CreateTaskForm.tsx`
 * (Заголовок/Описание/Дедлайн/Ответственный + Сохранить/Отмена), но полностью управляемая пропами
 * (`draft`/`onPatch`), без собственного стейта и без сабмита формы — стейт/валидация/мутация живут в
 * `useEditTaskForm` (см. проп-контракт в tasks.md), этот компонент только рендерит поля и зовёт
 * колбэки. Список сотрудников — тот же `tasksApi.getAssigneeEmployees()`
 * (`features/TaskStatusControl/model/api.ts`), что уже используется карточкой задачи для показа
 * имени ответственного (см. WHY там же), не кросс-импорт `features/CreateTask`'s `useEmployees`
 * (frontend/CLAUDE.md: features не могут импортировать друг друга). По той же причине блок ошибки
 * ниже не переиспользует `features/CreateTask/ui/FieldError.tsx` напрямую — тот же `role="alert"`/
 * `text-danger` инлайн, что уже использует `TaskStatusControl.tsx` для ошибки перехода статуса.
 */
export function EditTaskFields({
    draft,
    onPatch,
    onSave,
    onCancel,
    canSave,
    isPending,
    error,
}: EditTaskFieldsProps) {
    const employees = useQuery(tasksApi.getAssigneeEmployees())

    return (
        <div className="flex flex-col gap-3.5">
            <div className="flex flex-col gap-1.5">
                <label className="font-ui text-xs font-medium text-ink-muted" htmlFor="edit-task-title">
                    Заголовок
                </label>
                <Input
                    id="edit-task-title"
                    value={draft.title}
                    onChange={(event) => onPatch({ title: event.target.value })}
                    placeholder="Что нужно сделать"
                />
            </div>

            <div className="flex flex-col gap-1.5">
                <label className="font-ui text-xs font-medium text-ink-muted" htmlFor="edit-task-description">
                    Описание
                </label>
                <Textarea
                    id="edit-task-description"
                    value={draft.description}
                    onChange={(event) => onPatch({ description: event.target.value })}
                    placeholder="Необязательно — подробности задачи"
                />
            </div>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div className="flex flex-col gap-1.5">
                    <label className="font-ui text-xs font-medium text-ink-muted" htmlFor="edit-task-deadline">
                        Дедлайн
                    </label>
                    <Input
                        id="edit-task-deadline"
                        type="date"
                        value={draft.deadline}
                        onChange={(event) => onPatch({ deadline: event.target.value })}
                    />
                </div>

                <div className="flex flex-col gap-1.5">
                    <label className="font-ui text-xs font-medium text-ink-muted" htmlFor="edit-task-assignee">
                        Ответственный
                    </label>
                    <Select
                        value={draft.assigneeEmployeeId !== null ? String(draft.assigneeEmployeeId) : ''}
                        onValueChange={(value) => onPatch({ assigneeEmployeeId: Number(value) })}
                        disabled={employees.isLoading}
                    >
                        <SelectTrigger id="edit-task-assignee">
                            <SelectValue
                                placeholder={
                                    employees.isLoading
                                        ? 'Загрузка...'
                                        : employees.error
                                          ? 'Не удалось загрузить'
                                          : 'Выберите сотрудника'
                                }
                            />
                        </SelectTrigger>
                        <SelectContent>
                            {(employees.data ?? []).map((employee) => (
                                <SelectItem key={employee.id} value={String(employee.id)}>
                                    {employee.name}
                                </SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                </div>
            </div>

            {error?.message && (
                <p role="alert" className="font-ui text-xs text-danger">
                    {error.message}
                </p>
            )}

            <div className="flex justify-end gap-2">
                <Button type="button" variant="secondary" onClick={onCancel}>
                    Отмена
                </Button>
                <Button type="button" onClick={onSave} disabled={!canSave || isPending}>
                    {isPending ? 'Сохранение…' : 'Сохранить'}
                </Button>
            </div>
        </div>
    )
}
