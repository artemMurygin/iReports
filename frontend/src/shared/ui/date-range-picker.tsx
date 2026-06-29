import { useState } from 'react'
import { ru } from 'date-fns/locale'
import { format } from 'date-fns'
import type { DateRange } from 'react-day-picker'
import { Calendar } from './calendar'
import { Popover, PopoverContent, PopoverTrigger } from './popover'

interface Props {
    value: DateRange | undefined
    onChange: (range: DateRange) => void
}

function fmt(date: Date | undefined): string {
    if (!date) return '—'
    return format(date, 'd MMMM yyyy', { locale: ru })
}

export function DateRangePicker({ value, onChange }: Props) {
    const [fromOpen, setFromOpen] = useState(false)
    const [toOpen, setToOpen] = useState(false)

    return (
        <div className="flex items-center h-9 rounded-md border border-gray-200 overflow-hidden text-sm text-gray-700 shrink-0">
            <Popover open={fromOpen} onOpenChange={setFromOpen}>
                <PopoverTrigger asChild>
                    <button className="flex items-center gap-2 h-full px-3 hover:bg-gray-50 transition-colors border-r border-gray-200 cursor-pointer">
                        <span className="text-gray-400 shrink-0">С</span>
                        <span className="tabular-nums">{fmt(value?.from)}</span>
                    </button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                    <Calendar
                        mode="single"
                        selected={value?.from}
                        defaultMonth={value?.from}
                        onSelect={(date) => {
                            if (!date) return
                            const from = new Date(date.setHours(0, 0, 0, 0))
                            const to = value?.to && from <= value.to ? value.to : undefined
                            onChange({ from, to })
                            setFromOpen(false)
                            if (!to) setToOpen(true)
                        }}
                        disabled={(date) => value?.to ? date > value.to : false}
                        locale={ru}
                    />
                </PopoverContent>
            </Popover>

            <Popover open={toOpen} onOpenChange={setToOpen}>
                <PopoverTrigger asChild>
                    <button className="flex items-center gap-2 h-full px-3 hover:bg-gray-50 transition-colors cursor-pointer">
                        <span className="text-gray-400 shrink-0">По</span>
                        <span className="tabular-nums">{fmt(value?.to)}</span>
                    </button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                    <Calendar
                        mode="single"
                        selected={value?.to}
                        defaultMonth={value?.to ?? value?.from}
                        onSelect={(date) => {
                            if (!date) return
                            const to = new Date(date.setHours(23, 59, 59, 999))
                            onChange({ from: value?.from, to })
                            setToOpen(false)
                        }}
                        disabled={(date) => value?.from ? date < value.from : false}
                        locale={ru}
                    />
                </PopoverContent>
            </Popover>
        </div>
    )
}
