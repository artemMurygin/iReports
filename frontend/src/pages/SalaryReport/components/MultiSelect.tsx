import { ChevronDown } from 'lucide-react'
import { Popover, PopoverContent, PopoverTrigger } from '@/shared/ui/popover'

export interface SelectOption { id: number | string; label: string }

interface Props {
    options: SelectOption[]
    selected: (number | string)[]
    onChange: (ids: (number | string)[]) => void
    placeholder: string
    className?: string
}

export function MultiSelect({ options, selected, onChange, placeholder, className }: Props) {
    function toggle(id: number | string) {
        onChange(selected.includes(id) ? selected.filter((x) => x !== id) : [...selected, id])
    }

    const label =
        selected.length === 0
            ? placeholder
            : selected.length <= 2
              ? options
                    .filter((o) => selected.includes(o.id))
                    .map((o) => o.label)
                    .join(', ')
              : `${selected.length} выбрано`

    return (
        <Popover>
            <PopoverTrigger asChild>
                <button
                    className={`flex items-center gap-1.5 h-9 px-3 rounded-md border border-gray-200 text-sm text-gray-700 hover:bg-gray-50 bg-white transition-colors ${className ?? ''}`}
                >
                    <span className="truncate max-w-48">{label}</span>
                    <ChevronDown className="size-3.5 shrink-0 text-gray-400" />
                </button>
            </PopoverTrigger>
            <PopoverContent className="w-60 p-2 gap-0" align="start">
                <div className="max-h-56 overflow-y-auto">
                    {options.map((opt) => (
                        <label
                            key={opt.id}
                            className="flex items-center gap-2.5 px-2 py-1.5 rounded-lg hover:bg-gray-50 cursor-pointer text-sm text-gray-700"
                        >
                            <input
                                type="checkbox"
                                checked={selected.includes(opt.id)}
                                onChange={() => toggle(opt.id)}
                                className="size-3.5 rounded accent-emerald-500"
                            />
                            <span className="truncate">{opt.label}</span>
                        </label>
                    ))}
                    {options.length === 0 && (
                        <p className="text-xs text-gray-400 text-center py-3">Нет элементов</p>
                    )}
                </div>
            </PopoverContent>
        </Popover>
    )
}
