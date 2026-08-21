import { Clock, CreditCard, Package, PackageCheck, Percent, SquareCheck, Wrench } from 'lucide-react'

import { cn } from '@/shared/lib/tw'

import { isFloatPercentRule, type SalaryReportRule } from '../model/types.ts'

export type RuleTypeIconProps = {
    rule: SalaryReportRule
    className?: string
}

/**
 * Иконка правила внутри 22×22 рамки (Pencil: `b6mfxv`'s "Type Icon" `pz28j`/`QdBC3` — `surface`
 * fill, `hairline`-обводка, `r=6`, 12px `ink-muted` иконка по центру; тот же узел переиспользован
 * мобильным `d8XFk`). Сэмплы дизайна берут иконку не по `rule.type` напрямую, а по конкретному
 * award-варианту, которого в этом контракте нет (`config`/`award` не сериализуются в отчёт) —
 * поэтому здесь применяется ближайшее доступное правило: KPI-правило с плавающим процентом всегда
 * получает `percent` (совпадает с обоими найденными сэмплами floating-правил, `square-check` для
 * "Выполненная задача"/`TaskCompleted`, `credit-card` для "Оплата заказа"/`OrderPayed`), остальные
 * типы — по ближайшему смыслу иконки.
 *
 * Каждая ветка возвращает готовый JSX-элемент (а не ссылку на компонент в локальной переменной,
 * которую затем рендерят как `<Icon .../>`) — последнее ловит `react-hooks/static-components`
 * (компилятор не может доказать, что `Icon` — та же ссылка между рендерами, и считает её
 * "созданной во время рендера").
 */
function RuleIcon({ rule }: { rule: SalaryReportRule }) {
    const iconClassName = 'size-3 shrink-0 text-ink-muted'

    if (isFloatPercentRule(rule)) return <Percent className={iconClassName} />

    switch (rule.type) {
        case 'PayPerHour':
            return <Clock className={iconClassName} />
        case 'ServiceCompleted':
            return <Wrench className={iconClassName} />
        case 'TaskCompleted':
            return <SquareCheck className={iconClassName} />
        case 'ProductSold':
            return <Package className={iconClassName} />
        case 'UsedProductSold':
            return <PackageCheck className={iconClassName} />
        case 'OrderPayed':
        default:
            return <CreditCard className={iconClassName} />
    }
}

export function RuleTypeIcon({ rule, className }: RuleTypeIconProps) {
    return (
        <span
            className={cn(
                'flex size-[22px] shrink-0 items-center justify-center rounded-[6px] border border-hairline bg-surface',
                className,
            )}
        >
            <RuleIcon rule={rule} />
        </span>
    )
}
