import { Input } from '@/shared/ui-kit/atoms/Input'

import { FieldError } from './FieldError.tsx'

export type AmountFieldProps = {
    label: string
    value: string
    placeholder: string
    error?: string
    onValueChange: (value: string) => void
}

/**
 * Денежное поле карточки правила: `Ставка, ₽ / час` (`PayPerHour`), `Сумма, ₽` (награда `Fixed`) и
 * `Сумма вознаграждения, ₽` (`TaskCompleted`, `TaskCompletedFields.tsx`) — одна и та же разметка с
 * одинаковой фильтрацией ввода (`[^0-9.,]`), отличаются только подпись и плейсхолдер.
 */
export function AmountField({ label, value, placeholder, error, onValueChange }: AmountFieldProps) {
    return (
        <div className="flex flex-col gap-1.5 sm:w-[220px]">
            <label className="font-ui text-xs font-medium text-ink-muted">{label}</label>
            <Input
                inputMode="decimal"
                value={value}
                onChange={(event) => onValueChange(event.target.value.replace(/[^0-9.,]/g, ''))}
                placeholder={placeholder}
            />
            <FieldError message={error} />
        </div>
    )
}
