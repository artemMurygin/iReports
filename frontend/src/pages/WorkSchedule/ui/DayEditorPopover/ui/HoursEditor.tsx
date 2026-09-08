import { Minus, Plus } from 'lucide-react'

import { cn } from '@/shared/lib/tw'
import { IconButton } from '@/shared/ui-kit/atoms/IconButton'
import { Slider } from '@/shared/ui-kit/atoms/Slider'

import { formatHours } from '@/pages/WorkSchedule/model/cellPresentation.ts'
import { MAX_SHIFT_HOURS, MIN_SHIFT_HOURS, SHIFT_HOURS_STEP } from '@/pages/WorkSchedule/model/dayEditorPayload.ts'

export type HoursEditorProps = {
    hours: number
    onPreview: (hours: number) => void
    onCommit: (hours: number) => void
    onStep: (delta: number) => void
    disabled: boolean
}

/**
 * Pencil: design/sallary-first-iteration.pen, узел `Cko6w` → `Day Editor` → `Hours Row` +
 * `Hours Slider` — два способа задать одно и то же значение часов смены: степпер (−/значение/+ с
 * шагом 0,5) и слайдер с той же шкалой 2–16 (`Scale`-подписи по краям + «шаг 0,5 ч» посередине).
 * Оба задизейблены целиком, когда статус дня не «Работает» (`disabled`) — часы осмысленны только
 * у `WORKING` (см. `WorkDay` на бэкенде).
 *
 * `Slider`'s `onValueCommit` (не `onValueChange`) шлёт `onCommit` — сохранение уходит на сервер по
 * отпусканию ползунка, а не на каждый кадр драга (см. комментарий `useDayEditor.ts`). Тики шкалы
 * (29 штук, `Tick 2`…`Tick 16` в дизайне) не воспроизведены — сам `Slider`-атом не поддерживает
 * произвольные засечки на треке, а 29 абсолютно спозиционированных `div`-ов ради decoративной
 * детали, которую `Slider` и так передаёт значением/шагом, здесь не стоят усложнения.
 */
function HoursEditor({ hours, onPreview, onCommit, onStep, disabled }: HoursEditorProps) {
    return (
        <div data-slot="day-editor-hours" className={cn('flex w-full flex-col gap-[7px]', disabled && 'opacity-50')}>
            <div className="flex w-full items-center justify-between">
                <span className="font-ui text-xs font-normal text-ink-muted">Часы за смену</span>

                <div className="flex shrink-0 items-center gap-0.5 rounded-lg border border-hairline bg-surface p-[3px]">
                    <IconButton
                        type="button"
                        size="sm"
                        disabled={disabled || hours <= MIN_SHIFT_HOURS}
                        onClick={() => onStep(-SHIFT_HOURS_STEP)}
                        aria-label="Уменьшить часы смены"
                    >
                        <Minus />
                    </IconButton>
                    <span className="w-[36px] text-center font-ui text-[13px] font-semibold text-ink tabular-nums">
                        {formatHours(hours)} ч
                    </span>
                    <IconButton
                        type="button"
                        size="sm"
                        disabled={disabled || hours >= MAX_SHIFT_HOURS}
                        onClick={() => onStep(SHIFT_HOURS_STEP)}
                        aria-label="Увеличить часы смены"
                    >
                        <Plus />
                    </IconButton>
                </div>
            </div>

            <Slider
                aria-label="Часы за смену"
                value={hours}
                min={MIN_SHIFT_HOURS}
                max={MAX_SHIFT_HOURS}
                step={SHIFT_HOURS_STEP}
                disabled={disabled}
                onValueChange={onPreview}
                onValueCommit={onCommit}
            />

            <div className="flex w-full items-center justify-between">
                <span className="font-ui text-[10.5px] font-normal text-ink-faint">{MIN_SHIFT_HOURS} ч</span>
                <span className="font-ui text-[10.5px] font-medium text-ink-faint">шаг 0,5 ч</span>
                <span className="font-ui text-[10.5px] font-normal text-ink-faint">{MAX_SHIFT_HOURS} ч</span>
            </div>
        </div>
    )
}

export { HoursEditor }
