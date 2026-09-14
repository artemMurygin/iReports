import { useState } from 'react'
import { CircleAlert, SendHorizontal } from 'lucide-react'

import { Button } from '@/shared/ui-kit/atoms/Button.tsx'
import { Input } from '@/shared/ui-kit/atoms/Input.tsx'
import { cn } from '@/shared/lib/tw'

/**
 * Pencil `Q7v9pt`'s `SuDZe` (`Footer`) — однострочное поле «Написать комментарий…» + кнопка
 * «Отправить» в одну строку, а не многострочный `Textarea` в потоке секции «Комментарии» (как
 * раньше). Выделено из `TaskCommentsSection.tsx` в отдельный компонент именно поэтому: список
 * комментариев прокручивается вместе с остальным содержимым карточки, а поле ввода — нет.
 *
 * Рендерится через `TaskDetailsPanel`'s `TaskCommentComposerContainer` как `SidePanel`'s `footer`
 * (`shared/ui-kit/organisms/SidePanel.tsx`) — тот же приём, что уже даёт `RuleGroupDetailsPanel`/
 * `SalesPlanDetailsPanel`'s футеры (`pages/SalaryReportV2`), а не `position: sticky` внутри
 * `TaskStatusCard`: `sticky` не прижимает элемент к низу контейнера, если контент короче видимой
 * высоты панели (некому "прилипать" — не от чего скроллить), тогда как `SidePanel`'s `footer` —
 * настоящий `shrink-0`-сосед прокручиваемого содержимого, а не его часть, и остаётся у нижнего
 * края независимо от объёма контента. Поэтому у компонента нет своих `border-t`/`padding`/`bg` —
 * это уже даёт обёртка `SidePanel`'s `footer`-слота.
 */
export type TaskCommentComposerProps = {
    onAddComment: (text: string) => void
    isSubmitting?: boolean
    className?: string
}

export function TaskCommentComposer({ onAddComment, isSubmitting = false, className }: TaskCommentComposerProps) {
    const [text, setText] = useState('')
    const [showError, setShowError] = useState(false)

    function handleSend() {
        if (text.trim() === '') {
            setShowError(true)
            return
        }
        setShowError(false)
        onAddComment(text)
        setText('')
    }

    return (
        <div data-slot="task-comment-composer" className={cn('flex w-full flex-col gap-1.5', className)}>
            <div className="flex w-full items-center gap-3">
                <Input
                    aria-label="Написать комментарий"
                    placeholder="Написать комментарий…"
                    value={text}
                    onChange={(e) => {
                        setText(e.target.value)
                        if (showError && e.target.value.trim() !== '') setShowError(false)
                    }}
                    onKeyDown={(e) => {
                        if (e.key === 'Enter' && !e.shiftKey) {
                            e.preventDefault()
                            handleSend()
                        }
                    }}
                    className={cn('h-8', showError && 'border-danger')}
                />
                <Button type="button" onClick={handleSend} disabled={isSubmitting} className="shrink-0">
                    <SendHorizontal />
                    Отправить
                </Button>
            </div>
            {showError && (
                <p role="alert" className="flex items-center gap-1.5 font-ui text-[11.5px] text-danger">
                    <CircleAlert className="size-[13px] shrink-0" />
                    Комментарий не может быть пустым
                </p>
            )}
        </div>
    )
}
