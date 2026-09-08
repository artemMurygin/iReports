import { cn } from '@/shared/lib/tw'

/**
 * Pencil: design/sallary-first-iteration.pen, node `wQOPI` (`ERP/Molecule/Tabs`) — a `canvas`-
 * filled, hairline-bordered segmented-tab pill (8px radius, 2px inner gap, 3px padding); the
 * active tab is a `surface` chip with its own hairline border and 600-weight `ink` label, inactive
 * tabs are borderless with a 500-weight `ink-muted` label.
 *
 * `ui-design.md`'s "Отклонения от architecture.md" note: the base component ships with 3 tabs by
 * default, and both `RolesManagement` artboards (`s5nMLx`, `F6d3a`) disable the unused third slot
 * (`enabled: false`) — this component only ever renders as many tabs as it's given, so that
 * mismatch does not carry over into code.
 *
 * First-time build of this UI Kit molecule from its `uDEum` base (frontend/CLAUDE.md: new UI Kit
 * components go in `shared/ui-kit/`).
 */
export type TabItem = {
    id: string
    label: string
}

export type TabsProps = {
    tabs: TabItem[]
    activeId: string
    onChange: (id: string) => void
    className?: string
}

function Tabs({ tabs, activeId, onChange, className }: TabsProps) {
    return (
        <div
            data-slot="tabs"
            role="tablist"
            className={cn(
                'inline-flex w-fit items-center gap-0.5 rounded-lg border border-hairline bg-canvas p-[3px]',
                className,
            )}
        >
            {tabs.map((tab) => {
                const isActive = tab.id === activeId
                return (
                    <button
                        key={tab.id}
                        type="button"
                        role="tab"
                        aria-selected={isActive}
                        onClick={() => onChange(tab.id)}
                        data-slot="tab"
                        data-active={isActive || undefined}
                        className={cn(
                            'rounded-md px-3 py-1.5 font-ui text-[13px] font-medium whitespace-nowrap transition-colors outline-none focus-visible:ring-2 focus-visible:ring-brand/40',
                            isActive
                                ? 'border border-hairline bg-surface font-semibold text-ink'
                                : 'border border-transparent text-ink-muted hover:text-ink',
                        )}
                    >
                        {tab.label}
                    </button>
                )
            })}
        </div>
    )
}

export { Tabs }
