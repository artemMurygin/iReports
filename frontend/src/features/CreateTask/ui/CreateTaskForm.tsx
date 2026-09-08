import { Button } from '@/shared/ui-kit/atoms/Button'
import { Input } from '@/shared/ui-kit/atoms/Input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/shared/ui-kit/atoms/Select'
import { Textarea } from '@/shared/ui-kit/atoms/Textarea'

import { useCreateTaskForm } from '../model/useCreateTaskForm.ts'
import { useEmployees } from '../model/useEmployees.ts'

import { FieldError } from './FieldError.tsx'

export type CreateTaskFormProps = {
    /** Вызывается после успешного создания задачи с её `id`. Общая страница `/tasks` (раздел 13
     * tasks.md) может закрыть модалку/обновить список; Шаг 1 мастера создания правила
     * `TaskCompletion` (`pages/SalaryRuleDetail`, раздел 14 tasks.md) — перейти к Шагу 2, уже зная
     * `taskId` (см. `architecture.md`'s `CreateTaskCompletionRuleWizard`). */
    onCreated?: (taskId: string) => void
    /** Текст кнопки отправки — по умолчанию «Создать задачу»; Шаг 1 мастера может захотеть «Далее». */
    submitLabel?: string
}

/**
 * replace-bitrix-task-integration, раздел 11 tasks.md (11.3) — самостоятельная форма создания
 * задачи: заголовок, описание (необязательно), дедлайн, ответственный (селект сотрудника). Не знает
 * ничего про зарплатные правила (design.md решение 2/4, specs/tasks/spec.md «Задача — полностью
 * самостоятельная сущность») — только `title`/`description`/`deadline`/`assigneeEmployeeId` из
 * `CreateTaskRequest`.
 */
export function CreateTaskForm({ onCreated, submitLabel = 'Создать задачу' }: CreateTaskFormProps) {
    const { draft, patch, canSubmit, submit, isPending, error } = useCreateTaskForm(onCreated)
    const employees = useEmployees()

    return (
        <form
            className="flex flex-col gap-3.5"
            onSubmit={(event) => {
                event.preventDefault()
                submit()
            }}
        >
            <div className="flex flex-col gap-1.5">
                <label className="font-ui text-xs font-medium text-ink-muted" htmlFor="create-task-title">
                    Заголовок
                </label>
                <Input
                    id="create-task-title"
                    value={draft.title}
                    onChange={(event) => patch({ title: event.target.value })}
                    placeholder="Что нужно сделать"
                />
            </div>

            <div className="flex flex-col gap-1.5">
                <label className="font-ui text-xs font-medium text-ink-muted" htmlFor="create-task-description">
                    Описание
                </label>
                <Textarea
                    id="create-task-description"
                    value={draft.description}
                    onChange={(event) => patch({ description: event.target.value })}
                    placeholder="Необязательно — подробности задачи"
                />
            </div>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div className="flex flex-col gap-1.5">
                    <label className="font-ui text-xs font-medium text-ink-muted" htmlFor="create-task-deadline">
                        Дедлайн
                    </label>
                    <Input
                        id="create-task-deadline"
                        type="date"
                        value={draft.deadline}
                        onChange={(event) => patch({ deadline: event.target.value })}
                    />
                </div>

                <div className="flex flex-col gap-1.5">
                    <label className="font-ui text-xs font-medium text-ink-muted" htmlFor="create-task-assignee">
                        Ответственный
                    </label>
                    <Select
                        value={draft.assigneeEmployeeId !== null ? String(draft.assigneeEmployeeId) : ''}
                        onValueChange={(value) => patch({ assigneeEmployeeId: Number(value) })}
                        disabled={employees.isLoading}
                    >
                        <SelectTrigger id="create-task-assignee">
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

            <FieldError message={error?.message} />

            <Button type="submit" disabled={!canSubmit || isPending}>
                {isPending ? 'Создание…' : submitLabel}
            </Button>
        </form>
    )
}
