import { Columns3 } from 'lucide-react'
import { IconButton } from '@/shared/ui-kit/atoms/IconButton'
import { Checkbox } from '@/shared/ui-kit/atoms/Checkbox'
import { Popover, PopoverContent, PopoverTrigger } from '@/shared/ui-kit/atoms/Popover'
import { OPTIONAL_COLUMNS, type ColumnVisibility, type OptionalColumnId } from '@/features/ServicesTable/model/columns.ts'

type Props = {
    visibility: ColumnVisibility
    onToggle: (id: OptionalColumnId, checked: boolean) => void
}

/** Кнопка "Columns" в Actions Row шапки таблицы (Pencil: `h7eHG` → `tmW21` "Table Section") —
 * открывает список чекбоксов по одному на опциональную денежную колонку (# / Услуга / Продажи /
 * Тренд всегда видимы и здесь не участвуют, см. `model/columns.ts`). */
export function ColumnsPopover({ visibility, onToggle }: Props) {
    return (
        <Popover>
            <PopoverTrigger asChild>
                <IconButton aria-label="Настроить колонки" title="Колонки">
                    <Columns3 />
                </IconButton>
            </PopoverTrigger>
            <PopoverContent align="end" className="w-[236px] p-3">
                <p className="mb-2 px-1 font-ui text-[11px] font-semibold tracking-wide text-ink-muted uppercase">
                    Колонки
                </p>
                <div className="flex flex-col gap-1">
                    {OPTIONAL_COLUMNS.map((column) => (
                        <label
                            key={column.id}
                            className="flex cursor-pointer items-center gap-2 rounded-[6px] px-1 py-1.5 text-[13px] font-medium text-ink select-none hover:bg-canvas"
                        >
                            <Checkbox
                                checked={visibility[column.id]}
                                onCheckedChange={(checked) => onToggle(column.id, checked)}
                            />
                            {column.label}
                        </label>
                    ))}
                </div>
            </PopoverContent>
        </Popover>
    )
}
