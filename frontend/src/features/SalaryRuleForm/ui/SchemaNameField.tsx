import { Input } from '@/shared/ui-kit/atoms/Input'

export type SchemaNameFieldProps = {
    schemaName: string
    onSchemaNameChange: (name: string) => void
}

/** "Название схемы" — единственное свободное поле Шага 1; обрезка пробелов и проверка на пустоту
 * живут в `model/useSalaryRulesPage.ts` (`canSubmit`). */
export function SchemaNameField({ schemaName, onSchemaNameChange }: SchemaNameFieldProps) {
    return (
        <div className="flex flex-col gap-1.5">
            <label className="font-ui text-xs font-medium text-ink-muted">Название схемы</label>
            <Input
                value={schemaName}
                onChange={(event) => onSchemaNameChange(event.target.value)}
                placeholder="Например, Мотивация сервиса · Q3 2026"
            />
        </div>
    )
}
