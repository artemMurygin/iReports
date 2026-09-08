import { Pencil } from 'lucide-react'

import { Input } from '@/shared/ui-kit/atoms/Input'

export type SchemaNameFieldProps = {
    schemaName: string
    onSchemaNameChange: (name: string) => void
}

/** "Название схемы" — единственное свободное поле Шага 1; обрезка пробелов и проверка на пустоту
 * живут в `model/useSalaryRulesPage.ts` (`canSubmit`). Trailing pencil icon — Pencil: design/
 * sallary-first-iteration.pen, node `pWqkZ`/`AJpBQ` (edit page): decorative-only affordance (the
 * field is always directly editable, not a click-to-edit control), `pointer-events-none` so it
 * never intercepts clicks/focus meant for the input underneath. */
export function SchemaNameField({ schemaName, onSchemaNameChange }: SchemaNameFieldProps) {
    return (
        <div className="flex flex-col gap-1.5">
            <label className="font-ui text-xs font-medium text-ink-muted">Название схемы</label>
            <div className="relative">
                <Input
                    value={schemaName}
                    onChange={(event) => onSchemaNameChange(event.target.value)}
                    placeholder="Например, Мотивация сервиса · Q3 2026"
                    className="pr-9"
                />
                <Pencil
                    aria-hidden="true"
                    className="pointer-events-none absolute top-1/2 right-3 size-3.5 -translate-y-1/2 text-ink-faint"
                />
            </div>
        </div>
    )
}
