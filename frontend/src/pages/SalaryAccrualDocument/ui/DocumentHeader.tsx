import { ArrowLeft, CheckCheck, ChevronRight, Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import type { SalaryAccrualResponse } from 'ireports-contracts'

import {
    AccrualStatusBadge,
    DismissedBadge,
    employeeInitials,
    pluralizeLines,
    useAccrueDocument,
    type AccrualProgress,
} from '@/features/SalaryAccruals'
import { formatCurrency } from '@/features/SalesPlan'
import { cn } from '@/shared/lib/tw'
import { Avatar, AvatarFallback } from '@/shared/ui-kit/atoms/Avatar'
import { Button } from '@/shared/ui-kit/atoms/Button'

export type DocumentHeaderProps = {
    document: SalaryAccrualResponse
    periodLabel: string
    departmentName: string | null
    progress: AccrualProgress
    onBack: () => void
    className?: string
}

/**
 * Pencil `DQ3tV` (шапка документа, десктоп REDESIGN): хлебные крошки «Зарплата › Начисления ·
 * июль 2026 › ФИО», затем `Identity Row` (аватар + ФИО + статус-бейдж(+«Уволен») + мета — ТОЛЬКО
 * название отдела, «Розница»; направление/период/id документа из старой составной строки убраны —
 * они и так есть в хлебных крошках, перепроверено скриншотом `H45naW`/`S2MYw`) и «Итого к
 * начислению» справа, и отдельная `Actions Bar` НИЖЕ с верхней границей-разделителем: «Назад к
 * списку» слева, «Начислить всё» справа (Фаза 9 — видна, только пока в документе есть строки
 * `DRAFT`, и скрывается для `PAID`). Мобильная версия (`g0onp`'s `L9Lbc4` «Header Card») — та же
 * информация в одной карточке: Identity, затем «Итого» строка (метка+примечание «N строк · M
 * начислено» слева, крупная сумма справа, без отдельной полосы прогресса — `AccrualProgressBar` в
 * шапке убран вместе со старой строкой прогресса), затем `Actions` строка («К списку» / «Начислить
 * всё»). Номер документа мокапа («№A-2026-07-118») бэкенд не отдаёт — в мобильной мете показывается
 * id документа, на десктопе (мокап не incl. его в `S2MYw`) не показывается вовсе.
 */
export function DocumentHeader({ document, periodLabel, departmentName, progress, onBack, className }: DocumentHeaderProps) {
    const meta = departmentName ?? 'Без отдела'
    const linesCount = document.lines.length
    const accruedNote = `${linesCount} ${pluralizeLines(linesCount)} · ${progress.accruedCount ?? 0} начислено`

    const draftLineCount = document.lines.filter((line) => line.status === 'DRAFT').length
    const canAccrueAll = document.status !== 'PAID' && draftLineCount > 0
    const accrueDocument = useAccrueDocument(document.direction)

    function handleAccrueAll() {
        const total = draftLineCount
        accrueDocument.mutate(document.id, {
            onSuccess: (response) => {
                const failedCount = response.failures.length
                toast.success(`Начислено ${total - failedCount} из ${total} строк`)
                if (failedCount > 0) {
                    const [first, ...rest] = response.failures
                    toast.error(rest.length > 0 ? `${first.message} и ещё ${rest.length}` : first.message)
                }
            },
            onError: () => {
                toast.error('Не удалось начислить документ, попробуйте ещё раз')
            },
        })
    }

    const badges = (
        <>
            <AccrualStatusBadge status={document.status} />
            {document.isDismissed && <DismissedBadge />}
        </>
    )

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

            {/* Десктоп: Identity Row + Actions Bar отдельной строкой (Pencil `H45naW`) */}
            <div className="hidden flex-col gap-3.5 md:flex">
                <div className="flex items-center justify-between gap-6">
                    <div className="flex min-w-0 items-center gap-3.5">
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
                                <h1 className="font-display text-[26px] font-bold tracking-[-0.5px] text-ink">
                                    {document.employeeName}
                                </h1>
                                {badges}
                            </span>
                            <p className="truncate font-ui text-[13px] text-ink-muted">{meta}</p>
                        </div>
                    </div>

                    <div className="flex shrink-0 flex-col items-end gap-0.5">
                        <span className="font-ui text-[13px] text-ink-muted">Итого к начислению</span>
                        <span className="font-display text-[30px] font-bold tracking-[-0.5px] text-ink">
                            {formatCurrency(document.total)}
                        </span>
                    </div>
                </div>

                <div className="flex items-center justify-between gap-3 border-t border-hairline pt-3.5">
                    <Button type="button" variant="secondary" onClick={onBack}>
                        <ArrowLeft />
                        Назад к списку
                    </Button>
                    {canAccrueAll && (
                        <Button type="button" onClick={handleAccrueAll} disabled={accrueDocument.isPending}>
                            {accrueDocument.isPending ? <Loader2 className="animate-spin" /> : <CheckCheck />}
                            {accrueDocument.isPending ? 'Начисляем…' : 'Начислить всё'}
                        </Button>
                    )}
                </div>
            </div>

            {/* Мобильный: одна карточка Identity/Итого/Actions (Pencil `L9Lbc4`) */}
            <div className="flex flex-col rounded-xl border border-hairline bg-surface md:hidden">
                <div className="flex flex-col gap-2.5 p-3.5">
                    <div className="flex items-center gap-2.5">
                        <Avatar
                            size="lg"
                            className={cn(
                                document.isDismissed &&
                                    '[&_[data-slot=avatar-fallback]]:bg-danger-soft [&_[data-slot=avatar-fallback]]:text-danger',
                            )}
                        >
                            <AvatarFallback>{employeeInitials(document.employeeName)}</AvatarFallback>
                        </Avatar>
                        <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                            <span className="flex flex-wrap items-center gap-2">
                                <h1 className="font-display text-lg font-bold text-ink">{document.employeeName}</h1>
                                {badges}
                            </span>
                            <p className="truncate font-ui text-[11.5px] text-ink-muted">
                                {meta} · документ {document.id}
                            </p>
                        </div>
                    </div>

                    <div className="flex items-center justify-between gap-3 border-t border-hairline pt-2.5">
                        <div className="flex min-w-0 flex-col gap-0.5">
                            <span className="font-ui text-[11px] font-semibold tracking-[0.4px] text-ink-muted uppercase">
                                Итого к начислению
                            </span>
                            <span className="font-ui text-[11px] text-ink-muted">{accruedNote}</span>
                        </div>
                        <span className="shrink-0 font-display text-[26px] font-bold tracking-[-0.6px] text-ink">
                            {formatCurrency(document.total)}
                        </span>
                    </div>
                </div>

                <div className="flex items-center justify-between gap-2 border-t border-hairline p-3">
                    <Button type="button" variant="secondary" onClick={onBack}>
                        <ArrowLeft />
                        К списку
                    </Button>
                    {canAccrueAll && (
                        <Button type="button" onClick={handleAccrueAll} disabled={accrueDocument.isPending}>
                            {accrueDocument.isPending ? <Loader2 className="animate-spin" /> : <CheckCheck />}
                            {accrueDocument.isPending ? 'Начисляем…' : 'Начислить всё'}
                        </Button>
                    )}
                </div>
            </div>
        </div>
    )
}
