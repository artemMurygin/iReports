/**
 * Шапка карточки Шага 1 (Pencil `tSYIw` → `Карточка · Схема`): eyebrow "ШАГ 1 · КОМУ НАЧИСЛЯЕМ",
 * мобильный (`md:hidden`) бейдж "обязательно" из узлов `IScAL`/`AmfHy` (Фаза 5,
 * docs/salary-schema-creation-ui) и заголовок с подписью.
 */
export function TargetCardHeader() {
    return (
        <div className="flex flex-col gap-2.5 border-b border-hairline p-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="font-ui text-[10px] font-semibold tracking-[0.8px] text-ink-muted">
                    ШАГ 1 · КОМУ НАЧИСЛЯЕМ
                </span>
                <span className="rounded-[6px] bg-brand-soft px-2 py-[3px] font-ui text-[11px] font-semibold text-ok-ink md:hidden">
                    обязательно
                </span>
            </div>
            <div className="flex flex-col gap-[3px]">
                <h2 className="font-display text-[17px] font-bold text-ink">Схема начисления</h2>
                <p className="font-ui text-xs text-ink-muted">Кому начисляем и как называется схема</p>
            </div>
        </div>
    )
}
