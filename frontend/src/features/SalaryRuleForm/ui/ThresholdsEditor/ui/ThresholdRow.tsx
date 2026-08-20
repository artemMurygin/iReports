import { Input } from '@/shared/ui-kit/atoms/Input'
import { SegmentedControl, type SegmentedControlOption } from '@/shared/ui-kit/atoms/SegmentedControl'

import type { BorderDraft, BorderMode } from '../../../model/ruleDraft.ts'

const MODE_OPTIONS: SegmentedControlOption<BorderMode>[] = [
    { value: 'FIX', label: 'Фиксированный' },
    { value: 'LINEAR', label: 'Линейный' },
]

export type ThresholdRowProps = {
    border: BorderDraft
    index: number
    onChangeBorder: (index: number, patch: Partial<BorderDraft>) => void
}

/** Строка порога на десктопе — колонки `[1fr_110px_110px_260px]` под шапкой таблицы
 * (Pencil node `l0o4nP`). */
export function ThresholdRow({ border, index, onChangeBorder }: ThresholdRowProps) {
    return (
        <div className="grid grid-cols-[1fr_110px_110px_260px] items-center gap-2">
            <Input
                value={border.name}
                onChange={(event) => onChangeBorder(index, { name: event.target.value })}
                placeholder="Название"
            />
            <Input
                inputMode="decimal"
                value={border.fromPlanPercent}
                onChange={(event) =>
                    onChangeBorder(index, { fromPlanPercent: event.target.value.replace(/[^0-9.,-]/g, '') })
                }
                placeholder="0"
            />
            <Input
                inputMode="decimal"
                value={border.multiplier}
                onChange={(event) =>
                    onChangeBorder(index, { multiplier: event.target.value.replace(/[^0-9.,-]/g, '') })
                }
                placeholder="1,0"
            />
            <SegmentedControl
                aria-label={`Режим порога «${border.name || index + 1}»`}
                options={MODE_OPTIONS}
                value={border.mode}
                onValueChange={(mode) => onChangeBorder(index, { mode })}
            />
        </div>
    )
}

/** Pencil node `aJ2lQ` — one card per threshold on mobile: full-width Название,
    a 2-column От %/Множитель pair, full-width Режим tabs. */
export function ThresholdCard({ border, index, onChangeBorder }: ThresholdRowProps) {
    return (
        <div className="flex flex-col gap-3 rounded-[12px] border border-hairline bg-canvas p-3.5">
            <div className="flex flex-col gap-1.5">
                <label className="font-ui text-xs font-medium text-ink-muted">Название порога</label>
                <Input
                    value={border.name}
                    onChange={(event) => onChangeBorder(index, { name: event.target.value })}
                    placeholder="Название"
                />
            </div>
            <div className="grid grid-cols-2 gap-2.5">
                <div className="flex flex-col gap-1.5">
                    <label className="font-ui text-xs font-medium text-ink-muted">От % плана</label>
                    <Input
                        inputMode="decimal"
                        value={border.fromPlanPercent}
                        onChange={(event) =>
                            onChangeBorder(index, { fromPlanPercent: event.target.value.replace(/[^0-9.,-]/g, '') })
                        }
                        placeholder="0"
                    />
                </div>
                <div className="flex flex-col gap-1.5">
                    <label className="font-ui text-xs font-medium text-ink-muted">Множитель</label>
                    <Input
                        inputMode="decimal"
                        value={border.multiplier}
                        onChange={(event) =>
                            onChangeBorder(index, { multiplier: event.target.value.replace(/[^0-9.,-]/g, '') })
                        }
                        placeholder="1,0"
                    />
                </div>
            </div>
            <div className="flex flex-col gap-1.5">
                <label className="font-ui text-xs font-medium text-ink-muted">Режим</label>
                <SegmentedControl
                    aria-label={`Режим порога «${border.name || index + 1}»`}
                    options={MODE_OPTIONS}
                    value={border.mode}
                    onValueChange={(mode) => onChangeBorder(index, { mode })}
                />
            </div>
        </div>
    )
}
