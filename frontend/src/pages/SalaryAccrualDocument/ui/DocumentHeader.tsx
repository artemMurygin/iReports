import { ArrowLeft, ChevronRight } from 'lucide-react'
import type { SalaryAccrualResponse } from 'ireports-contracts'

import {
    AccrualProgressBar,
    AccrualStatusBadge,
    DismissedBadge,
    employeeInitials,
    type AccrualProgress,
} from '@/features/SalaryAccruals'
import { formatCurrency } from '@/features/SalesPlan'
import { cn } from '@/shared/lib/tw'
import { Avatar, AvatarFallback } from '@/shared/ui-kit/atoms/Avatar'
import { Button } from '@/shared/ui-kit/atoms/Button'

export type DocumentHeaderProps = {
    document: SalaryAccrualResponse
    directionLabel: string
    periodLabel: string
    departmentName: string | null
    progress: AccrualProgress
    onBack: () => void
    className?: string
}

/**
 * Pencil `jb7fL` (шапка документа, desktop): хлебные крошки «Зарплата › Начисления ·
 * июль 2026 › ФИО», аватар + ФИО + статус-бейдж (+ «Уволен»), мета «Отдел · направление ·
 * период · документ», справа «Итого к начислению» крупно и secondary «Назад к списку».
 * Мобильная шапка (`wYi5o`) — та же карточка с прогрессом «Начислено N из M» и полосой
 * (ниже `md:` полоса видима, крошки сжимаются). Primary «Начислить всё» — Фаза 9.
 * Номер документа мокапа («№A-2026-07-118») бэкенд не отдаёт — показывается id документа.
 */
export function DocumentHeader({ document, directionLabel, periodLabel, departmentName, progress, onBack, className }: DocumentHeaderProps) {
    const meta = [
        departmentName,
        `направление «${directionLabel}»`,
        `период ${periodLabel}`,
        `документ ${document.id}`,
    ]
        .filter((part): part is string => part !== null)
        .join(' · ')

    return (
        <div data-slot="accrual-document-header" className={cn('flex flex-col gap-4', className)}>
            <nav aria-label="Хлебные крошки" className="flex min-w-0 items-center gap-1.5 font-ui text-[13px]">
                <span className="shrink-0 text-ink-muted">Зарплата</span>
                <ChevronRight className="size-3.5 shrink-0 text-ink-faint" />
                <button
                    type="button"
                    onClick={onBack}
                    className="shrink-0 text-ink-muted transition-colors hover:text-ink"
                >
                    Начисления · {periodLabel}
                </button>
                <ChevronRight className="size-3.5 shrink-0 text-ink-faint" />
                <span className="truncate font-medium text-ink">{document.employeeName}</span>
            </nav>

            <div className="flex flex-col gap-4 rounded-xl border border-hairline bg-surface p-4 md:flex-row md:items-center md:justify-between md:rounded-none md:border-0 md:bg-transparent md:p-0">
                <div className="flex items-center gap-3.5">
                    <Avatar
                        size="lg"
                        className={cn(
                            document.isDismissed &&
                                '[&_[data-slot=avatar-fallback]]:bg-danger-soft [&_[data-slot=avatar-fallback]]:text-danger',
                        )}
                    >
                        <AvatarFallback>{employeeInitials(document.employeeName)}</AvatarFallback>
                    </Avatar>
                    <div className="flex min-w-0 flex-col gap-1">
                        <span className="flex flex-wrap items-center gap-2">
                            <h1 className="font-display text-[22px] font-bold tracking-[-0.4px] text-ink md:text-[26px]">
                                {document.employeeName}
                            </h1>
                            <AccrualStatusBadge status={document.status} />
                            {document.isDismissed && <DismissedBadge />}
                        </span>
                        <p className="font-ui text-[13px] break-all text-ink-muted md:truncate">{meta}</p>
                    </div>
                </div>

                <div className="flex flex-wrap items-center gap-x-5 gap-y-3 md:justify-end">
                    <div className="flex min-w-0 flex-col gap-0.5 md:items-end">
                        <span className="font-ui text-[13px] text-ink-muted">Итого к начислению</span>
                        <span className="font-display text-[26px] font-bold tracking-[-0.5px] text-ink md:text-[30px]">
                            {formatCurrency(document.total)}
                        </span>
                    </div>
                    <Button type="button" variant="secondary" onClick={onBack}>
                        <ArrowLeft />
                        Назад к списку
                    </Button>
                </div>

                <div className="flex flex-col gap-1.5 md:hidden">
                    <span className="font-ui text-xs text-ink-muted tabular-nums">Начислено {progress.label}</span>
                    <AccrualProgressBar progress={progress} hideLabel />
                </div>
            </div>
        </div>
    )
}
