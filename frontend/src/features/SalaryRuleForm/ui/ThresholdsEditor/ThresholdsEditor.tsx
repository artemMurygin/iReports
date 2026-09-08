import { ChartNoAxesColumn, ChevronDown, ChevronUp } from 'lucide-react'

import { summarizeBorders } from '../../model/ruleSummary.ts'
import type { BorderDraft } from '../../model/ruleDraft.ts'

import { ThresholdCard, ThresholdRow } from './ui/ThresholdRow.tsx'

export type ThresholdsEditorProps = {
    borders: BorderDraft[]
    expanded: boolean
    onToggleExpanded: () => void
    onChangeBorder: (index: number, patch: Partial<BorderDraft>) => void
    error?: string | null
    className?: string
}

/**
 * Pencil: design/sallary-first-iteration.pen, node `l0o4nP` (`Пороги · Развёрнуто (десктоп)`) for
 * the expanded state, `MlMFl` (`Пороги · Свёрнуто`) for the collapsed one — the `percentBorders`
 * editor for `FloatPercent` awards: always exactly 3 rows (Ниже плана / Выполнение плана /
 * Перевыполнение by default, see `ruleDraft.ts`'s `defaultBorders`), each with Название / От %
 * плана / Множитель / Режим (`FIX`/`LINEAR` via `SegmentedControl`, mirroring the mockup's own
 * "Mode"/"Basis Tabs" 2–3-option tab pattern). Collapsed state shows an icon, a static title, and
 * `summarizeBorders`'s one-line summary next to a "Настроить пороги"/chevron toggle.
 *
 * Фаза 5 (mobile adaptive): below `md:`, each of the 3 rows renders as its own bordered card
 * (`ui/ThresholdRow.tsx`'s `ThresholdCard`, Pencil node `aJ2lQ`, `Пороги · Развёрнуто (мобильный)`)
 * instead of a `[1fr_110px_110px_260px]` table row (`ThresholdRow`) — "Название порога" full width,
 * "От % плана"/"Множитель" as a 2-column pair, "Режим" full width below. Both variants read/write
 * the exact same `borders`/`onChangeBorder` — this is a pure breakpoint-switched presentational
 * split (`hidden md:grid` / `flex md:hidden`), not two copies of the editing logic.
 */
export function ThresholdsEditor({
    borders,
    expanded,
    onToggleExpanded,
    onChangeBorder,
    error,
    className,
}: ThresholdsEditorProps) {
    if (!expanded) {
        return (
            <div className={className}>
                <button
                    type="button"
                    onClick={onToggleExpanded}
                    className="flex w-full items-center gap-3 rounded-[10px] border border-hairline bg-canvas p-[11px_12px] text-left transition-colors hover:bg-hairline/30"
                >
                    <ChartNoAxesColumn className="size-4 shrink-0 text-ink-muted" />
                    <div className="flex flex-1 flex-col gap-[3px]">
                        <span className="font-ui text-xs font-semibold text-ink">
                            Правило формирования плавающего процента
                        </span>
                        <span className="font-ui text-[11.5px] leading-[1.35] text-ink-muted">
                            {summarizeBorders(borders)}
                        </span>
                    </div>
                    <span className="flex shrink-0 items-center gap-1.5 font-ui text-xs font-semibold text-ok-ink">
                        Настроить пороги
                        <ChevronDown className="size-[15px]" />
                    </span>
                </button>
                {error && <p className="mt-1.5 font-ui text-xs text-danger">{error}</p>}
            </div>
        )
    }

    return (
        <div className={className}>
            <div className="flex w-full flex-col gap-3 rounded-[10px] border border-hairline bg-surface p-3.5">
                <div className="flex items-center justify-between gap-2">
                    <div className="flex flex-col gap-0.5">
                        <span className="font-ui text-[13px] font-bold text-ink">
                            Правило формирования плавающего процента
                        </span>
                        <span className="font-ui text-xs text-ink-muted">
                            Множитель применяется к базовому проценту в зависимости от выполнения плана
                        </span>
                    </div>
                    <button
                        type="button"
                        onClick={onToggleExpanded}
                        className="flex shrink-0 items-center gap-1.5 font-ui text-xs font-semibold text-ok-ink"
                    >
                        Свернуть
                        <ChevronUp className="size-[15px]" />
                    </button>
                </div>

                <div className="hidden grid-cols-[1fr_110px_110px_260px] gap-2 px-1 md:grid">
                    <span className="font-ui text-[11px] font-medium text-ink-faint">Название порога</span>
                    <span className="font-ui text-[11px] font-medium text-ink-faint">От % плана</span>
                    <span className="font-ui text-[11px] font-medium text-ink-faint">Множитель</span>
                    <span className="font-ui text-[11px] font-medium text-ink-faint">Режим</span>
                </div>

                <div className="hidden flex-col gap-2 md:flex">
                    {borders.map((border, index) => (
                        // Fixed 3-row list (no add/remove/reorder), so an index key is stable and fine here.
                        <ThresholdRow key={index} border={border} index={index} onChangeBorder={onChangeBorder} />
                    ))}
                </div>

                <div className="flex flex-col gap-3 md:hidden">
                    {borders.map((border, index) => (
                        <ThresholdCard key={index} border={border} index={index} onChangeBorder={onChangeBorder} />
                    ))}
                </div>

                {error && <p className="font-ui text-xs text-danger">{error}</p>}
            </div>
        </div>
    )
}
