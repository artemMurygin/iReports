import type { TaskComment } from 'ireports-contracts'

import { Avatar, AvatarFallback } from '@/shared/ui-kit/atoms/Avatar.tsx'
import { InlineNote } from '@/shared/ui-kit/molecules/InlineNote.tsx'
import { cn } from '@/shared/lib/tw'

import { useAssigneeName } from '../model/useAssigneeName.ts'
import { SECTION_LABEL_CLASS } from './sectionLabel.ts'

/**
 * Pencil: `XSPm8` (`ERP/Molecule/Comment Item`), `F7ai0` (`Inline Note`, пустой список — `r86qEK`).
 * Только список — форма ввода вынесена в `TaskCommentComposer.tsx` (Pencil `Q7v9pt`'s `SuDZe`
 * `Footer`, прибитый к низу панели, а не часть этой прокручиваемой секции, см.
 * `TaskStatusCard.tsx`).
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
    className?: string
}

export function TaskCommentsSection({ comments, className }: TaskCommentsSectionProps) {
    return (
        <div data-slot="task-comments-section" className={cn('flex w-full flex-col gap-3', className)}>
            <p className={SECTION_LABEL_CLASS}>Комментарии{comments.length > 0 ? ` · ${comments.length}` : ''}</p>

            {comments.length === 0 ? (
                <InlineNote>Комментариев пока нет. Напишите первый — его увидят все, кто открывает задачу.</InlineNote>
            ) : (
                <div className="flex w-full flex-col gap-3.5">
                    {comments.map((comment) => (
                        <CommentRow key={comment.id} comment={comment} />
                    ))}
                </div>
            )}
        </div>
    )
}
