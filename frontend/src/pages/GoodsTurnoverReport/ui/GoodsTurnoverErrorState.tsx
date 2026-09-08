import { RefreshCw, TriangleAlert } from 'lucide-react'

import { cn } from '@/shared/lib/tw.ts'
import { Button } from '@/shared/ui-kit/atoms/Button'

export type GoodsTurnoverErrorStateProps = {
    message: string
    onRetry: () => void
    className?: string
}

/**
 * Состояние «Ошибка загрузки» тела отчёта (openspec/changes/service-turnover-report, задача 19.2;
 * ui-design.md узлы `W2qBFM` десктоп / `SSiyp` мобайл — `Get`+`resolveVariables` подтвердил:
 * `$danger-soft` (`#FDECEC`) заливка карточки, белый кружок 64/56px с иконкой `triangle-alert`
 * `$danger`, заголовок "Не удалось загрузить отчёт" (font-display 18/17px 700), описание —
 * `ApiError.message` с бэкенда (не статичный текст макета — задача явно требует показывать
 * реальный текст ошибки, `shared/errors/apiError.ts`), кнопка `Btn Повторить`
 * (`ERP/Atom/Button` secondary: белая заливка, `refresh-cw` + «Повторить»)).
 *
 * По структуре — тот же паттерн empty-state карточки, что уже используется в проекте
 * (`pages/SalaryRuleList/ui/EmptyStateNoSchemas.tsx`, `pages/WorkSchedule/ui/ScheduleEmptyState.tsx`
 * — кружок-иконка + заголовок + описание [+ действие]), просто на `danger`-токенах вместо
 * `brand`-токенов и с добавленной кнопкой повтора.
 */
export function GoodsTurnoverErrorState({ message, onRetry, className }: GoodsTurnoverErrorStateProps) {
    return (
        <div
            data-slot="goods-turnover-error-state"
            className={cn(
                'flex min-h-[320px] flex-col items-center justify-center gap-4 rounded-xl border border-hairline bg-danger-soft px-6 py-12 text-center md:min-h-[420px] md:py-16',
                className,
            )}
        >
            <div className="flex size-14 items-center justify-center rounded-full bg-surface md:size-16">
                <TriangleAlert className="size-6 text-danger md:size-7" />
            </div>

            <div className="flex flex-col items-center gap-2">
                <h2 className="font-display text-base font-bold tracking-[-0.2px] text-ink md:text-lg">
                    Не удалось загрузить отчёт
                </h2>
                <p className="max-w-[420px] font-ui text-[13px] leading-[1.5] text-ink-muted">{message}</p>
            </div>

            <Button type="button" variant="secondary" onClick={onRetry}>
                <RefreshCw />
                Повторить
            </Button>
        </div>
    )
}
