import { Clock4 } from 'lucide-react'

import { cn } from '@/shared/lib/tw.ts'

export type GoodsTurnoverNotRecalculatedStateProps = {
    className?: string
}

/**
 * Состояние «Отчёт ещё не пересчитан» (openspec/changes/service-turnover-report, задача 19.3;
 * ui-design.md узлы `S5rxTH` десктоп / `w4caPq` мобайл) — показывается, когда бэкенд вернул
 * пустой список строк для периода (`GetGoodsTurnoverReportResponse.lines === []`, design.md D5 —
 * валидный ответ, не ошибка: месяц ещё ни разу не пересчитывался почасовым кроном, задача 11).
 *
 * Намеренно БЕЗ CTA — действие не требуется от пользователя, пересчёт произойдёт сам в течение
 * часа (design.md D6). Текст и иконка `clock-4`/`$brand-soft` вычитаны из `Get`+`resolveVariables`
 * по обоим узлам — совпадают дословно между десктопом и мобайлом, отличается только `padding`/
 * ширина карточки.
 */
export function GoodsTurnoverNotRecalculatedState({ className }: GoodsTurnoverNotRecalculatedStateProps) {
    return (
        <div
            data-slot="goods-turnover-not-recalculated-state"
            className={cn(
                'flex min-h-[320px] flex-col items-center justify-center gap-4 rounded-xl border border-hairline bg-surface px-6 py-12 text-center md:min-h-[420px] md:py-16',
                className,
            )}
        >
            <div className="flex size-14 items-center justify-center rounded-full bg-brand-soft md:size-16">
                <Clock4 className="size-6 text-ok-ink md:size-7" />
            </div>

            <div className="flex flex-col items-center gap-2">
                <h2 className="font-display text-base font-bold tracking-[-0.2px] text-ink md:text-lg">
                    Отчёт ещё не пересчитан
                </h2>
                <p className="max-w-[440px] font-ui text-[13px] leading-[1.5] text-ink-muted">
                    Данные за этот месяц появятся автоматически после первого почасового пересчёта — обычно в течение
                    часа
                </p>
            </div>

            <p className="font-ui text-xs text-ink-faint">Обновится без вашего участия — обновите страницу позже</p>
        </div>
    )
}
