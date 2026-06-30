import { ChevronLeft, ChevronRight } from 'lucide-react'
import { format, addMonths, subMonths } from 'date-fns'
import { ru } from 'date-fns/locale'

interface Props {
    value: Date
    onChange: (date: Date) => void
}

export function PeriodPicker({ value, onChange }: Props) {
    return (
        <div className="flex items-center gap-1 rounded-lg border border-gray-200 bg-white px-1 py-1 shrink-0">
            <button
                onClick={() => onChange(subMonths(value, 1))}
                className="p-1 rounded hover:bg-gray-100 text-gray-500 transition-colors"
            >
                <ChevronLeft className="size-4" />
            </button>
            <span className="px-2 text-sm font-medium text-gray-900 min-w-[120px] text-center capitalize">
                {format(value, 'LLLL yyyy', { locale: ru })}
            </span>
            <button
                onClick={() => onChange(addMonths(value, 1))}
                className="p-1 rounded hover:bg-gray-100 text-gray-500 transition-colors"
            >
                <ChevronRight className="size-4" />
            </button>
        </div>
    )
}
