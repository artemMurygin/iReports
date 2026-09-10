import { useState } from 'react'
import { CircleAlert, Info, SendHorizontal } from 'lucide-react'
import type { TaskComment } from 'ireports-contracts'

import { Avatar, AvatarFallback } from '@/shared/ui-kit/atoms/Avatar.tsx'
import { Button } from '@/shared/ui-kit/atoms/Button.tsx'
import { Textarea } from '@/shared/ui-kit/atoms/Textarea.tsx'
import { cn } from '@/shared/lib/tw'

import { useAssigneeName } from '../model/useAssigneeName.ts'

/**
 * Pencil: `XSPm8` (`ERP/Molecule/Comment Item`), `F7ai0` (`Inline Note`, пустой список — `r86qEK`),
 * форма с ошибкой пустого текста (`sTuwF`, `cW0k5`). architecture.md: `TaskCommentsSection` —
 * `{ comments, onAddComment, isSubmitting }` (tasks.md группа 25).
 *
 * Локальная валидация «текст не пуст» — по тому же приёму, что и `TaskLinksSection`'s локальная
 * проверка URL: компонент не получает ошибку хука `useTaskComments` через пропы (architecture.md
 * не даёт такого канала), поэтому сам не пускает пустой/пробельный текст дальше `onAddComment` и
 * показывает ошибку сразу по клику «Отправить» (`spec: tasks/comments#Requirement: Пустой комментарий
 * отклоняется`).
 */
function initialsOf(name: string): string {
    const parts = name.trim().split(/\s+/)
    return parts
        .slice(0, 2)
        .map((p) => p[0]?.toUpperCase())
        .join('')
}

function formatCommentTime(createdAt: Date | string): string {
    return new Date(createdAt).toLocaleString('ru-RU', {
        day: '2-digit',
        month: 'short',
        hour: '2-digit',
        minute: '2-digit',
    })
}

function CommentRow({ comment }: { comment: TaskComment }) {
    const authorName = useAssigneeName(comment.authorEmployeeId) ?? `Сотрудник #${comment.authorEmployeeId}`
    return (
        <div className="flex w-full items-start gap-2.5">
            <Avatar size="sm">
                <AvatarFallback>{initialsOf(authorName)}</AvatarFallback>
            </Avatar>
            <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                    <span className="font-ui text-[12.5px] font-semibold text-ink">{authorName}</span>
                    <span className="font-ui text-[11.5px] text-ink-faint">{formatCommentTime(comment.createdAt)}</span>
                </div>
                <p className="mt-1 font-ui text-[13px] leading-snug text-ink">{comment.text}</p>
            </div>
        </div>
    )
}

export type TaskCommentsSectionProps = {
    comments: TaskComment[]
    onAddComment: (text: string) => void
    isSubmitting?: boolean
    className?: string
}

export function TaskCommentsSection({
    comments,
    onAddComment,
    isSubmitting = false,
    className,
}: TaskCommentsSectionProps) {
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
        <div data-slot="task-comments-section" className={cn('flex w-full flex-col gap-3', className)}>
            <p className="font-ui text-xs font-medium text-ink-muted">
                Комментарии{comments.length > 0 ? ` · ${comments.length}` : ''}
            </p>

            {comments.length === 0 ? (
                <div className="flex w-full items-center gap-2 rounded-lg border border-hairline bg-canvas p-3">
                    <Info className="size-[15px] shrink-0 text-ink-muted" />
                    <p className="font-ui text-xs text-ink-muted">
                        Комментариев пока нет. Напишите первый — его увидят все, кто открывает задачу.
                    </p>
                </div>
            ) : (
                <div className="flex w-full flex-col gap-3.5">
                    {comments.map((comment) => (
                        <CommentRow key={comment.id} comment={comment} />
                    ))}
                </div>
            )}

            <div className="flex w-full flex-col gap-2">
                <Textarea
                    aria-label="Написать комментарий"
                    placeholder="Написать комментарий…"
                    rows={3}
                    value={text}
                    onChange={(e) => {
                        setText(e.target.value)
                        if (showError && e.target.value.trim() !== '') setShowError(false)
                    }}
                    className={showError ? 'border-danger' : undefined}
                />
                {showError && (
                    <p role="alert" className="flex items-center gap-1.5 font-ui text-[11.5px] text-danger">
                        <CircleAlert className="size-[13px] shrink-0" />
                        Комментарий не может быть пустым
                    </p>
                )}
                <div className="flex w-full justify-end">
                    <Button type="button" onClick={handleSend} disabled={isSubmitting || showError}>
                        <SendHorizontal />
                        Отправить
                    </Button>
                </div>
            </div>
        </div>
    )
}
