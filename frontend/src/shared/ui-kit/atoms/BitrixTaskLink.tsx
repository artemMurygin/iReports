import { SquareArrowOutUpRight } from 'lucide-react'

import { cn } from '@/shared/lib/tw'

export type BitrixTaskLinkProps = {
    /** Прямая ссылка на карточку задачи в веб-интерфейсе Bitrix24 (бэкенд:
     * `buildBitrixTaskLink()`, `integrations/bitrix/bitrix.config.ts`) — открывается в новой
     * вкладке. */
    href: string
    /** Подпись ссылки — по умолчанию «Задача в Bitrix24» (открытый отчёт/схема мотивации,
     * `TaskRulePanel`); список незакрытых задач перед закрытием периода (`UnclosedTaskRulesList`)
     * передаёт более компактный вариант. */
    label?: string
    className?: string
}

/**
 * Ссылка на задачу Bitrix24, привязанную к правилу-задаче (`salary-rule-bitrix-task`) —
 * извлечена из `pages/SalaryReportV2/ui/TaskRulePanel.tsx` (открытый и закрытый отчёт по
 * зарплате, схема мотивации), чтобы список незакрытых задач перед закрытием периода
 * (`features/AccountingPeriod/ui/ClosePeriodDialog/ui/UnclosedTaskRulesList.tsx`,
 * docs/task-rule-archiving-and-links, Фаза 5) переиспользовал тот же компонент, а не копировал
 * вёрстку — оба места живут в разных FSD-слоях (`pages`/`features`), поэтому общий компонент
 * должен лежать в `shared`.
 */
function BitrixTaskLink({ href, label = 'Задача в Bitrix24', className }: BitrixTaskLinkProps) {
    return (
        <a
            href={href}
            target="_blank"
            rel="noopener noreferrer"
            data-slot="bitrix-task-link"
            className={cn(
                'inline-flex items-center gap-1 font-ui text-xs font-semibold text-info-ink hover:underline',
                className,
            )}
        >
            {label}
            <SquareArrowOutUpRight className="size-3" />
        </a>
    )
}

export { BitrixTaskLink }
