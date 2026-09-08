import { cn } from '@/shared/lib/tw'

export type FieldErrorProps = {
    message?: string | null
    className?: string
}

/** Строка ошибки под полем — по прецеденту `features/SalaryRuleForm/ui/RuleFormCard/ui/FieldError.tsx`
 * (не переиспользуется напрямую: кросс-импорт между features запрещён, frontend/CLAUDE.md). */
export function FieldError({ message, className }: FieldErrorProps) {
    if (!message) return null

    return <p className={cn('font-ui text-xs text-danger', className)}>{message}</p>
}
