import { useState } from 'react'
import { Check, ChevronDown, Search, X } from 'lucide-react'
import { cn } from '@/shared/lib/twUtils'
import { Popover, PopoverContent, PopoverTrigger } from '@/shared/ui/popover'

export interface MultiSelectOption {
    value: string
    label: string
}

interface MultiSelectProps {
    options: MultiSelectOption[]
    selected: string[]
    onChange: (selected: string[]) => void
    placeholder: string
    width?: string
    searchable?: boolean
}

export function MultiSelect({
    options,
    selected,
    onChange,
    placeholder,
    width = 'w-[180px]',
    searchable = false,
}: MultiSelectProps) {
    const [open, setOpen] = useState(false)
    const [query, setQuery] = useState('')

    const toggle = (value: string) => {
        onChange(
            selected.includes(value) ? selected.filter((v) => v !== value) : [...selected, value],
        )
    }

    const filtered =
        searchable && query.trim()
            ? options.filter((o) => o.label.toLowerCase().includes(query.toLowerCase()))
            : options

    const label =
        selected.length === 0
            ? placeholder
            : selected.length === 1
              ? (options.find((o) => o.value === selected[0])?.label ?? '1 выбран')
              : `${selected.length} выбрано`

    return (
        <Popover
            open={open}
            onOpenChange={(v) => {
                setOpen(v)
                if (!v) setQuery('')
            }}
        >
            <PopoverTrigger asChild>
                <button
                    className={cn(
                        'flex items-center justify-between gap-2 h-9 px-3 rounded-md border border-gray-200 cursor-pointer hover:border-gray-300 transition-colors text-sm text-gray-700',
                        width,
                    )}
                >
                    <span className="truncate">{label}</span>
                    {selected.length > 0 ? (
                        <X
                            className="w-4 h-4 text-gray-400 hover:text-gray-600 shrink-0"
                            onClick={(e) => {
                                e.stopPropagation()
                                onChange([])
                            }}
                        />
                    ) : (
                        <ChevronDown className="w-4 h-4 text-gray-500 shrink-0" />
                    )}
                </button>
            </PopoverTrigger>
            <PopoverContent className={cn('p-1', width)} align="start">
                {searchable && (
                    <div className="flex items-center gap-2 px-2 py-1.5 mb-1 border-b border-gray-100">
                        <Search className="w-3.5 h-3.5 text-gray-400 shrink-0" />
                        <input
                            autoFocus
                            value={query}
                            onChange={(e) => setQuery(e.target.value)}
                            placeholder="Поиск..."
                            className="flex-1 text-sm bg-transparent outline-none text-gray-700 placeholder:text-gray-400"
                        />
                        {query && (
                            <button onClick={() => setQuery('')}>
                                <X className="w-3.5 h-3.5 text-gray-400 hover:text-gray-600" />
                            </button>
                        )}
                    </div>
                )}
                <div className="max-h-60 overflow-y-auto scrollbar-hide [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]">
                    {filtered.length === 0 && (
                        <p className="text-sm text-gray-400 text-center py-3">Ничего не найдено</p>
                    )}
                    {filtered.map((option) => {
                        const isSelected = selected.includes(option.value)
                        return (
                            <button
                                key={option.value}
                                onClick={() => toggle(option.value)}
                                className="flex items-center gap-2 w-full px-2 py-1.5 rounded text-sm text-left hover:bg-gray-100 transition-colors"
                            >
                                <div
                                    className={cn(
                                        'flex items-center justify-center w-4 h-4 rounded border shrink-0',
                                        isSelected
                                            ? 'bg-primary border-primary'
                                            : 'border-gray-300',
                                    )}
                                >
                                    {isSelected && <Check className="w-3 h-3 text-white" />}
                                </div>
                                {option.label}
                            </button>
                        )
                    })}
                </div>
            </PopoverContent>
        </Popover>
    )
}
