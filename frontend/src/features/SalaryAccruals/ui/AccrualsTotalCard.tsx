import { Info } from 'lucide-react'

import { formatCurrency } from '@/shared/lib/format.ts'
import { cn } from '@/shared/lib/tw'
import { Divider } from '@/shared/ui-kit/atoms/Divider'
import { IconButton } from '@/shared/ui-kit/atoms/IconButton'
import { Popover, PopoverContent, PopoverTrigger } from '@/shared/ui-kit/atoms/Popover'

import { pluralizeDocuments, type AccrualsTotals } from '../model/accrualView.ts'

export type AccrualsTotalCardProps = {
    totals: AccrualsTotals
    /** «июль 2026». */
    periodLabel: string
    /** «Сервис» / «Магазин». */
    directionLabel: string
    /** Название выбранного отдела, `null` — «Все отделы» (заметка ниже суммы тогда без отдела). */
    departmentName: string | null
    className?: string
}

/**
 * Карточка «Итого» (Pencil `LvW0I`'s `RsJQs`, `Ed0FF`/`DtPgO`'s `z5nFJg`) — замена удалённого
 * `AccrualsKpiRow` (4 отдельные KPI-карточки «Фонд/Сотрудников/Черновик/Ожидает»): слева «К
 * начислению · {период}» + сумма всех документов текущей области + подпись с числом документов,
 * направлением и отделом; справа «Начислено на текущий момент» + сумма уже полностью начисленных
 * документов + пилюля «N из M документов». Один компонент на оба брейкпоинта, как `LedgerHero`
 * (`pages/SalaryReportV2`) — строка на десктопе, стопка Top/Divider/Bottom на мобильном.
 *
 * `totals` считается по уже отфильтрованному (отдел + статус) списку страницы, поэтому карточка
 * отражает именно то, что видно ниже в таблице/карточках, а не весь список за период.
 *
 * Границы разные по брейкпоинту: на мобильном (`DtPgO`'s `z5nFJg`) это самостоятельная карточка
 * (свои `rounded-xl border`) — на странице нет общего «Ledger»-контейнера, который бы её обрамил;
 * на десктопе (`LvW0I`'s `RsJQs`) она — верхняя секция внутри `AccrualsLedgerCard`, где рамку и
 * нижний разделитель даёт сам `AccrualsLedgerCard` (тот же приём, что `LedgerHero`/`LedgerCard`
 * в `pages/SalaryReportV2`), поэтому здесь на `md:` рамка/скругление снимаются.
 */
function AccrualsTotalCard({ totals, periodLabel, directionLabel, departmentName, className }: AccrualsTotalCardProps) {
    const totalDocsLabel = `${totals.totalDocsCount} ${pluralizeDocuments(totals.totalDocsCount)}`
    const noteParts = [totalDocsLabel, `направление «${directionLabel}»`, departmentName].filter(
        (part): part is string => part !== null,
    )

    return (
        <div
            data-slot="accruals-total-card"
            className={cn(
                'flex flex-col gap-3 rounded-xl border border-hairline bg-surface p-4 md:flex-row md:items-center md:justify-between md:gap-6 md:rounded-none md:border-0 md:p-5',
                className,
            )}
        >
            <div className="flex min-w-0 flex-col gap-1">
                <span className="font-ui text-[11px] font-semibold text-ink-muted">К начислению · {periodLabel}</span>
                <span className="font-display text-[28px] font-bold tracking-[-0.4px] text-ink tabular-nums">
                    {formatCurrency(totals.toAccrueAmount)}
                </span>
                <span className="truncate font-ui text-xs text-ink-muted">{noteParts.join(' · ')}</span>
            </div>

            <Divider orientation="horizontal" className="md:hidden" />

            <div className="flex flex-col gap-1 md:items-end">
                <span className="flex items-center gap-1.5 font-ui text-[11px] font-semibold text-ink-muted">
                    Начислено на текущий момент
                    <Popover>
                        <PopoverTrigger asChild>
                            <IconButton size="sm" aria-label="Как считается «Начислено на текущий момент»">
                                <Info />
                            </IconButton>
                        </PopoverTrigger>
                        <PopoverContent align="end" className="max-w-[260px]">
                            <p className="font-ui text-xs text-ink-muted">
                                Сумма документов, начисленных полностью (все правила проведены). Частично начисленные
                                документы пока не входят в эту сумму — точная сумма по проведённым строкам таких
                                документов на уровне списка недоступна, они учтены только в счётчике «из M документов»
                                справа.
                            </p>
                        </PopoverContent>
                    </Popover>
                </span>
                <span className="font-display text-lg font-bold tracking-[-0.3px] text-ink-muted tabular-nums md:text-xl">
                    {formatCurrency(totals.accruedSoFarAmount)}
                </span>
                <span className="inline-flex w-fit items-center rounded-[6px] bg-brand-soft px-2 py-[3px] font-ui text-[11px] font-semibold text-ok-ink tabular-nums">
                    {totals.accruedDocsCount} из {totalDocsLabel}
                </span>
            </div>
        </div>
    )
}

export { AccrualsTotalCard }
