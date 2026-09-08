interface MiniCardHeaderProps {
    source: string
}

export function Header({ source }: MiniCardHeaderProps) {
    return (
        <span className="text-[11px] leading-tight text-muted-foreground truncate" title={source}>
            {source}
        </span>
    )
}
