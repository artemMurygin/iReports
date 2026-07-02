interface Props {
    value: string // 'YYYY-MM'
    onChange: (period: string) => void
}

export function PeriodMonthInput({ value, onChange }: Props) {
    return (
        <input
            type="month"
            value={value}
            onChange={(e) => e.target.value && onChange(e.target.value)}
            className="h-9 px-3 rounded-md border border-gray-200 text-sm text-gray-700 tabular-nums focus:outline-none focus:border-emerald-500"
        />
    )
}
