import { cn } from '@/shared/lib/tw'

export type FieldErrorProps = {
    message?: string | null
    className?: string
}

/**
 * Одна строка ошибки под полем карточки правила — повторяющийся
 * `<p className="font-ui text-xs text-danger">` из всех блоков формы. Сам решает, рендерить ли
 * себя, чтобы условие не размножалось по каждому полю.
 */
export function FieldError({ message, className }: FieldErrorProps) {
    if (!message) return null

    return <p className={cn('font-ui text-xs text-danger', className)}>{message}</p>
}
