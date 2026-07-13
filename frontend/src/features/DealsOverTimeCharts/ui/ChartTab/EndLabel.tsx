interface EndLabelProps {
    x?: number
    y?: number
    index?: number
    value?: number
    dataLength: number
    label: string
    color: string
}

export function EndLabel({ x = 0, y = 0, index = 0, value, dataLength, label, color }: EndLabelProps) {
    if (index !== dataLength - 1 || !value) return <g />
    return (
        <text x={x + 6} y={y} dy={4} fontSize={11} fill={color} textAnchor="start">
            {label}
        </text>
    )
}
