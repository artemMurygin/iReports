import { cn } from '@/shared/lib/tw'

export type FooterNoteProps = {
    className?: string
}

/**
 * Pencil: design/sallary-first-iteration.pen, узел `A5SbT` -> `Footer Note` — подсказка о смысле
 * счётчика в ленте недели и о том, что по сотруднику можно тапнуть. Текст дизайна дословно
 * документирует поведение, реализованное в `EmployeeRow`/`AbsenceGroupRow` (тап -> ссылка на
 * график сотрудника), поэтому воспроизведён как есть, без изменений.
 */
export function FooterNote({ className }: FooterNoteProps) {
    return (
        <p className={cn('font-ui text-[11px] leading-[15px] text-ink-muted', className)}>
            Цифра в ячейке — человек в смене. Нажмите на сотрудника, чтобы открыть его график.
        </p>
    )
}
