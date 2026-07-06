interface MiniCardBodyProps {
    lastVal: number
    pct: number | null
    lineColor: string
}

export function Body({ lastVal, pct, lineColor }: MiniCardBodyProps) {
    return (
        <div className="flex items-baseline gap-1.5 flex-wrap">
            <span className="text-lg font-semibold tabular-nums text-foreground">
                {lastVal.toLocaleString('ru-RU')}
            </span>
            {pct !== null && (
                <span className="text-[11px] font-medium" style={{ color: lineColor }}>
                    {pct > 0 ? '+' : ''}
                    {pct.toFixed(1)}%
                </span>
            )}
        </div>
    )
}
