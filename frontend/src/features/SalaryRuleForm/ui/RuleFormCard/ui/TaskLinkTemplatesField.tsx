import { useState } from 'react'
import { CircleAlert, Link as LinkIcon, Plus, X } from 'lucide-react'

import { Button } from '@/shared/ui-kit/atoms/Button.tsx'
import { IconButton } from '@/shared/ui-kit/atoms/IconButton.tsx'
import { Input } from '@/shared/ui-kit/atoms/Input.tsx'

type LinkTemplate = { url: string; label?: string }

export type TaskLinkTemplatesFieldProps = {
    links: LinkTemplate[]
    onAddLink: (url: string, label?: string) => void
    onRemoveLink: (index: number) => void
    /** split-task-completion-rule-form — переопределяемый заголовок: разовое правило
     * (`TaskCompletionRuleFields.tsx`) переиспользует этот же компонент над `draft.taskLinks`
     * (ссылки конкретной, единственной задачи), а не над `draft.taskLinkTemplates` (шаблон на
     * каждый период), поэтому подпись по умолчанию там не подходит. */
    label?: string
}

/**
 * add-task-rule-task-lifecycle — набор ссылок, прикрепляемых `EnsureRuleTaskForPeriodService` к
 * каждой АВТОСОЗДАННОЙ задаче регулярного правила (см. `draft.taskLinkTemplates`'s WHY в
 * `ruleDraft.ts`). Своя копия `features/CreateTask/ui/TaskLinksField.tsx` (тот же UI/UX — список +
 * инлайн-форма добавления над локальным массивом `{url, label?}[]`), а не импорт: кросс-фичевый
 * импорт запрещён (frontend/CLAUDE.md), а сам компонент здесь работает над `draft.taskLinkTemplates`
 * через `onChange`, а не над отдельным `useState`-черновиком до создания задачи, как у `CreateTask`.
 */
export function TaskLinkTemplatesField({
    links,
    onAddLink,
    onRemoveLink,
    label: sectionLabel = 'Ссылки для новой задачи периода',
}: TaskLinkTemplatesFieldProps) {
    const [isFormOpen, setIsFormOpen] = useState(false)
    const [url, setUrl] = useState('')
    const [label, setLabel] = useState('')
    const [urlError, setUrlError] = useState(false)

    function resetForm() {
        setIsFormOpen(false)
        setUrl('')
        setLabel('')
        setUrlError(false)
    }

    function handleAdd() {
        try {
            new URL(url)
        } catch {
            setUrlError(true)
            return
        }
        onAddLink(url, label.trim() === '' ? undefined : label.trim())
        resetForm()
    }

    return (
        <div data-slot="task-link-templates-field" className="flex flex-col gap-2">
            <div className="flex items-center justify-between gap-2.5">
                <p className="font-ui text-xs font-medium text-ink-muted">{sectionLabel}</p>
                {!isFormOpen && (
                    <Button type="button" variant="ghost" size="sm" onClick={() => setIsFormOpen(true)}>
                        <Plus className="size-[13px]" />
                        Добавить
                    </Button>
                )}
            </div>

            {links.length > 0 && (
                <div className="flex flex-col gap-2">
                    {links.map((link, index) => (
                        <div
                            key={`${link.url}-${index}`}
                            className="flex w-full items-center gap-2.5 rounded-lg bg-surface py-2 pr-2 pl-2.5"
                        >
                            <LinkIcon className="size-[15px] shrink-0 text-ink-muted" />
                            <div className="min-w-0 flex-1">
                                <p className="truncate font-ui text-[13px] font-medium text-ink">{link.label ?? link.url}</p>
                                {link.label && <p className="truncate font-ui text-[11.5px] text-ink-muted">{link.url}</p>}
                            </div>
                            <IconButton aria-label="Удалить ссылку" size="sm" onClick={() => onRemoveLink(index)}>
                                <X className="size-3.5" />
                            </IconButton>
                        </div>
                    ))}
                </div>
            )}

            {isFormOpen && (
                <div className="flex w-full flex-col gap-2 rounded-md bg-surface p-3">
                    <div className="flex flex-col gap-1.5">
                        <Input
                            aria-label="Адрес ссылки"
                            placeholder="https://…"
                            value={url}
                            onChange={(e) => {
                                setUrl(e.target.value)
                                if (urlError) setUrlError(false)
                            }}
                            className={urlError ? 'border-danger' : undefined}
                        />
                        {urlError && (
                            <p role="alert" className="flex items-center gap-1.5 font-ui text-[11.5px] text-danger">
                                <CircleAlert className="size-[13px] shrink-0" />
                                Введите адрес целиком, например https://disk.irepair.ru/albums
                            </p>
                        )}
                    </div>
                    <Input
                        aria-label="Подпись ссылки"
                        placeholder="Подпись — необязательно"
                        value={label}
                        onChange={(e) => setLabel(e.target.value)}
                    />
                    <div className="flex justify-end gap-2">
                        <Button type="button" variant="ghost" onClick={resetForm}>
                            Отмена
                        </Button>
                        <Button type="button" onClick={handleAdd}>
                            <Plus />
                            Добавить ссылку
                        </Button>
                    </div>
                </div>
            )}
        </div>
    )
}
