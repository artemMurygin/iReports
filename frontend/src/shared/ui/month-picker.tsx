import { useState } from 'react'
import { ru } from 'date-fns/locale'
import { format } from 'date-fns'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { Popover, PopoverContent, PopoverTrigger } from './popover'

interface Props {
    value: string // 'YYYY-MM'
    onChange: (period: string) => void
}

const MONTHS = [
    'Янв', 'Фев', 'Мар', 'Апр',
    'Май', 'Июн', 'Июл', 'Авг',
    'Сен', 'Окт', 'Ноя', 'Дек',
]

function fmtPeriod(period: string): string {
    const [y, m] = period.split('-')
    return format(new Date(Number(y), Number(m) - 1), 'LLLL yyyy', { locale: ru })
}

export function MonthPicker({ value, onChange }: Props) {
    const [open, setOpen] = useState(false)
    const [year, setYear] = useState(() => Number(value.split('-')[0]))

    const selYear = Number(value.split('-')[0])
    const selMonth = Number(value.split('-')[1]) - 1

    function select(monthIndex: number) {
        const m = String(monthIndex + 1).padStart(2, '0')
        onChange(`${year}-${m}`)
        setOpen(false)
    }

    return (
        <Popover open={open} onOpenChange={(o) => { setOpen(o); if (o) setYear(selYear) }}>
            <PopoverTrigger asChild>
                <button className="flex items-center h-9 px-3 rounded-md border border-gray-200 text-sm text-gray-700 hover:bg-gray-50 transition-colors cursor-pointer shrink-0 capitalize">
                    {fmtPeriod(value)}
                </button>
            </PopoverTrigger>
            <PopoverContent className="w-56 p-3" align="start">
                <div className="flex items-center justify-between mb-2">
                    <button
                        onClick={() => setYear((y) => y - 1)}
                        className="p-1 rounded hover:bg-gray-100 text-gray-500 transition-colors"
                    >
                        <ChevronLeft className="size-4" />
                    </button>
                    <span className="text-sm font-medium text-gray-900 tabular-nums">{year}</span>
                    <button
                        onClick={() => setYear((y) => y + 1)}
                        className="p-1 rounded hover:bg-gray-100 text-gray-500 transition-colors"
                    >
                        <ChevronRight className="size-4" />
                    </button>
                </div>
                <div className="grid grid-cols-3 gap-1">
                    {MONTHS.map((name, i) => {
                        const isSelected = year === selYear && i === selMonth
                        return (
                            <button
                                key={i}
                                onClick={() => select(i)}
                                className={`px-2 py-1.5 text-sm rounded-md transition-colors ${
                                    isSelected
                                        ? 'bg-gray-900 text-white'
                                        : 'text-gray-700 hover:bg-gray-100'
                                }`}
                            >
                                {name}
                            </button>
                        )
                    })}
                </div>
            </PopoverContent>
        </Popover>
    )
}
