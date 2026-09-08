import { cn } from '@/shared/lib/tw.ts'

export type PeriodStatusBadgeProps = {
    isClosed: boolean
    className?: string
}

/**
 * Пилюля статуса расчётного периода в Filter Row (openspec/changes/service-turnover-report,
 * задача 19.4; ui-design.md узлы `QVydh`/`Sk1nF` десктоп, `B07YMi`/`PmBey` мобайл — точка + текст,
 * `$brand-soft`/`$ok-ink` открыт, `$info-soft`/`$info-ink` закрыт, тот же паттерн, что уже
 * используется в `pages/SalesPlan/ui/PageHeader.tsx` для статуса `AccountingPeriod`).
 *
 * Статус читается снаружи из `AccountingPeriod` направления `service`
 * (`useAccountingPeriod('service', period)`, `features/AccountingPeriod`) — не дублируется
 * отдельным полем в `GoodsTurnoverReportLine`/ответе отчёта (design.md D5/D7). Никакой кнопки
 * закрытия/пересчёта здесь нет и не будет — по design.md D7 закрытие отчёта по оборачиваемости не
 * самостоятельное действие пользователя, оно происходит автоматически вместе с закрытием
 * расчётного периода направления «Сервис».
 *
 * Полный текст («Открыт · пересчёт каждый час» / «Период закрыт · данные зафиксированы») —
 * десктопный вариант из `QVydh`/`Sk1nF`; на мобайле (`B07YMi`/`PmBey`) тот же паттерн, но короче
 * («Открыт» / «Закрыт») — узкая колонка `Row A` рядом с полем периода. Один и тот же DOM-узел,
 * два `<span>` текста переключаются классами `md:hidden`/`hidden md:inline` (тот же приём, что
 * `WarehouseSelect`, только внутри одной пилюли, а не двух отдельных обёрток — сама пилюля
 * визуально одинакова на обоих брейкпоинтах, меняется только текст).
 */
export function PeriodStatusBadge({ isClosed, className }: PeriodStatusBadgeProps) {
    return (
        <div
            data-slot="period-status-badge"
            className={cn(
                'flex shrink-0 items-center gap-1.5 rounded-lg px-3 py-[7px]',
                isClosed ? 'bg-info-soft' : 'bg-brand-soft',
                className,
            )}
        >
            <span className={cn('size-[7px] shrink-0 rounded-full', isClosed ? 'bg-info-ink' : 'bg-ok-ink')} aria-hidden />
            <span className={cn('font-ui text-xs font-semibold whitespace-nowrap', isClosed ? 'text-info-ink' : 'text-ok-ink')}>
                <span className="hidden md:inline">
                    {isClosed ? 'Период закрыт · данные зафиксированы' : 'Открыт · пересчёт каждый час'}
                </span>
                <span className="md:hidden">{isClosed ? 'Закрыт' : 'Открыт'}</span>
            </span>
        </div>
    )
}
