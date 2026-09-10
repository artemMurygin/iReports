import { Layers, Lock, X } from 'lucide-react'
import type { SalaryRuleDetail } from 'ireports-contracts'

import { cn } from '@/shared/lib/tw.ts'
import { ALL_RULE_TYPE_LABELS } from '@/kernel/ruleTypeLabels.ts'
import { Badge } from '@/shared/ui-kit/atoms/Badge.tsx'
import { Chip } from '@/shared/ui-kit/atoms/Chip.tsx'
import { IconButton } from '@/shared/ui-kit/atoms/IconButton.tsx'
import { SpecRow } from '@/shared/ui-kit/molecules/SpecRow.tsx'
import { InlineNote } from '@/shared/ui-kit/molecules/InlineNote.tsx'

import { DIRECTION_LABEL, ROLE_LABELS } from './labels.ts'
import { getRuleParams } from './ruleParams.ts'

/**
 * Pencil: `XiJo6` (десктоп 1440, панель 460px), `Nuezn` (мобильный 390, bottom sheet). Презентационная
 * карточка описания правила внутри панели (architecture.md, UI-компоненты: `SalaryRuleSummaryCard
 * { rule }` — `onClose` добавлен сверх перечисленных «основных» пропов, по тому же прецеденту, что
 * `TaskStatusCard`'s `onClose?`, tasks.md группа 27/architecture.md). Read-only: без кнопок
 * редактирования, только плашка «только для просмотра» (design.md Non-Goals — редактирование
 * остаётся на странице зарплатного правила).
 *
 * Рендерит собственный заголовок (название правила + подпись + крестик закрытия, узел `Header`/
 * `O3HrO`) сама, а не через `SidePanel`'s `title`-слот — тот же приём, что уже применяет
 * `TaskStatusCard` внутри `TaskDetailsPanel` (`SidePanel` получает только `srOnlyTitle`): контент
 * появляется только после загрузки правила, поэтому во время `isLoading` заголовка нет вовсе (как
 * и у `TaskStatusControl`'s "Загрузка задачи…").
 */
export type SalaryRuleSummaryCardProps = {
    rule: SalaryRuleDetail
    onClose?: () => void
    className?: string
}

export function SalaryRuleSummaryCard({ rule, onClose, className }: SalaryRuleSummaryCardProps) {
    const params = getRuleParams(rule)

    return (
        <div data-slot="salary-rule-summary-card" className={cn('flex w-full flex-col bg-surface', className)}>
            <div className="flex items-start justify-between gap-4 border-b border-hairline px-5 py-4">
                <div className="min-w-0 flex-1">
                    <h2 className="truncate font-display text-[17px] font-bold text-ink">{rule.name}</h2>
                    <p className="mt-[3px] font-ui text-xs text-ink-muted">Зарплатное правило · только просмотр</p>
                </div>
                {onClose && (
                    <IconButton aria-label="Закрыть панель правила" onClick={onClose} className="shrink-0">
                        <X />
                    </IconButton>
                )}
            </div>

            <div className="flex flex-col gap-5 p-5">
                <div className="flex items-center justify-between gap-2.5">
                    <Badge tone="violet" className="rounded-lg px-3 py-1.5 text-[13px]">
                        {ALL_RULE_TYPE_LABELS[rule.type] ?? rule.type}
                    </Badge>
                    <Chip icon={<Layers />}>{DIRECTION_LABEL[rule.direction]}</Chip>
                </div>

                <div className="flex gap-5">
                    <div className="flex-1">
                        <p className="font-ui text-xs font-medium text-ink-muted">Роль</p>
                        <p className="mt-1.5 font-ui text-sm font-medium text-ink">{ROLE_LABELS[rule.targetRole]}</p>
                    </div>
                    <div className="flex-1">
                        <p className="font-ui text-xs font-medium text-ink-muted">Схема начисления</p>
                        <p className="mt-1.5 font-ui text-sm font-medium text-ink">{rule.motivationSchemaName}</p>
                    </div>
                </div>

                <div className="h-px w-full bg-hairline" />

                {params.length > 0 && (
                    <div className="flex flex-col gap-2">
                        <p className="font-ui text-xs font-medium text-ink-muted">Параметры правила</p>
                        <div className="flex flex-col">
                            {params.map((param, index) => (
                                <SpecRow
                                    key={param.key}
                                    label={param.label}
                                    value={param.value}
                                    showDivider={index < params.length - 1}
                                    valueClassName={
                                        param.emphasize ? 'font-display text-[13.5px] font-bold tracking-tight' : undefined
                                    }
                                />
                            ))}
                        </div>
                    </div>
                )}

                <div className="h-px w-full bg-hairline" />

                <InlineNote icon={<Lock className="size-[15px] shrink-0 text-ink-muted" />}>
                    Правило открыто только для просмотра. Изменить его можно на странице зарплатного правила.
                </InlineNote>
            </div>
        </div>
    )
}
