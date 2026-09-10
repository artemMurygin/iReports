import { useState } from 'react'
import { CircleAlert, Info, Link as LinkIcon, Plus, X } from 'lucide-react'
import type { TaskLink } from 'ireports-contracts'

import { Button } from '@/shared/ui-kit/atoms/Button.tsx'
import { IconButton } from '@/shared/ui-kit/atoms/IconButton.tsx'
import { Input } from '@/shared/ui-kit/atoms/Input.tsx'
import { cn } from '@/shared/lib/tw'

/**
 * Pencil: `baDJe` (`ERP/Molecule/Link Row`, список), `F7ai0` (`Inline Note`, пустой список —
 * `r86qEK`), форма «Новая ссылка» с ошибкой адреса (`AbvRd`, `cW0k5`). architecture.md:
 * `TaskLinksSection` — `{ links, onAddLink, onRemoveLink }` (tasks.md группа 25).
 *
 * Валидация URL здесь — собственная, локальная (не проп извне, architecture.md не даёт компоненту
 * канал для ошибки хука `useTaskLinks`): форма должна показать ошибку сразу по клику «Добавить
 * ссылку», не дожидаясь сетевого round-trip, поэтому `isValidUrl` дублирует ту же проверку, что уже
 * есть в `useTaskLinks` (та же причина дублирования, что комментарий в самом хуке — приём уже принят
 * в этом фиче-модуле, не изобретаю новый).
 */
function isValidUrl(value: string): boolean {
    try {
        new URL(value)
        return true
    } catch {
        return false
    }
}

export type TaskLinksSectionProps = {
    links: TaskLink[]
    onAddLink: (url: string, label?: string) => void
    onRemoveLink: (linkId: string) => void
    className?: string
}

export function TaskLinksSection({ links, onAddLink, onRemoveLink, className }: TaskLinksSectionProps) {
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

    function handleSubmit() {
        if (!isValidUrl(url)) {
            setUrlError(true)
            return
        }
        onAddLink(url, label.trim() === '' ? undefined : label.trim())
        resetForm()
    }

    return (
        <div data-slot="task-links-section" className={cn('flex w-full flex-col gap-3', className)}>
            <div className="flex w-full items-center justify-between gap-2.5">
                <p className="font-ui text-xs font-medium text-ink-muted">Ссылки</p>
                {!isFormOpen && (
                    <Button type="button" variant="ghost" size="sm" onClick={() => setIsFormOpen(true)}>
                        <Plus className="size-[13px]" />
                        Добавить
                    </Button>
                )}
            </div>

            {links.length === 0 && !isFormOpen && (
                <div className="flex w-full items-center gap-2 rounded-lg border border-hairline bg-canvas p-3">
                    <Info className="size-[15px] shrink-0 text-ink-muted" />
                    <p className="font-ui text-xs text-ink-muted">
                        Ссылок пока нет — добавьте адрес файла или документа по задаче.
                    </p>
                </div>
            )}

            {links.length > 0 && (
                <div className="flex w-full flex-col gap-2">
                    {links.map((link) => (
                        <div key={link.id} className="flex w-full items-center gap-2.5 rounded-lg bg-canvas py-2 pr-2 pl-2.5">
                            <LinkIcon className="size-[15px] shrink-0 text-ink-muted" />
                            <div className="min-w-0 flex-1">
                                <p className="truncate font-ui text-[13px] font-medium text-ink">
                                    {link.label ?? link.url}
                                </p>
                                {link.label && <p className="truncate font-ui text-[11.5px] text-ink-muted">{link.url}</p>}
                            </div>
                            <IconButton aria-label="Удалить ссылку" size="sm" onClick={() => onRemoveLink(link.id)}>
                                <X className="size-3.5" />
                            </IconButton>
                        </div>
                    ))}
                </div>
            )}

            {isFormOpen && (
                <div className="flex w-full flex-col gap-2 rounded-md bg-canvas p-3">
                    <p className="font-ui text-xs font-semibold text-ink">Новая ссылка</p>
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
                        <Button type="button" onClick={handleSubmit}>
                            <Plus />
                            Добавить ссылку
                        </Button>
                    </div>
                </div>
            )}
        </div>
    )
}
