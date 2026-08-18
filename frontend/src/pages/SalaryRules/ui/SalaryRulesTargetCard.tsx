import { ListChecks } from 'lucide-react'
import type { MotivationRequest } from 'ireports-contracts'

import { Input } from '@/shared/ui-kit/atoms/Input'
import { RadioCard } from '@/shared/ui-kit/atoms/RadioCard'
import { SegmentedControl, type SegmentedControlOption } from '@/shared/ui-kit/atoms/SegmentedControl'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/shared/ui-kit/atoms/Select'

import { pluralizeRules } from '../model/ruleSummary.ts'
import type { SchemaDirection } from '../model/types.ts'

type TargetType = MotivationRequest['targetType']

export type TargetOption = { id: number; name: string }

export type SalaryRulesTargetCardProps = {
    direction: SchemaDirection
    onDirectionChange: (direction: SchemaDirection) => void
    targetType: TargetType
    onTargetTypeChange: (targetType: TargetType) => void
    targetId: number | null
    onTargetIdChange: (targetId: number) => void
    targetOptions: TargetOption[]
    isTargetOptionsLoading: boolean
    targetOptionsError?: string | null
    schemaName: string
    onSchemaNameChange: (name: string) => void
    /** Step 2's current draft count — only read to render the mobile-only "В схеме N правил"
     * connector footer (node `MMh80`), never used for any decision here. */
    ruleCount: number
    className?: string
}

// Фаза 4 включает "Магазин" (макет `ZMEof`) — оба направления теперь реально сохраняют схему,
// каждое своим отдельным эндпоинтом/контрактом (см. `SalaryRulesPage.tsx`). Цель начисления
// (Отдел/Сотрудник, ниже) не зависит от направления: `GET /v1/directory/departments|employees`
// отдаёт общий Bitrix-справочник, а `motivation_schemas` ищется/создаётся по `(targetType,
// targetId)` без учёта направления — направление живёт только на уровне отдельных `salary_rules`
// (см. ENDPOINTS.md, `POST /v1/service|shop/accounting/motivation-schema`).
const DIRECTION_OPTIONS: SegmentedControlOption<SchemaDirection>[] = [
    { value: 'service', label: 'Сервис' },
    { value: 'shop', label: 'Магазин' },
]

/**
 * Pencil: design/sallary-first-iteration.pen, node `tSYIw` → `Колонка · Схема` → `Карточка ·
 * Схема` — Шаг 1 "Кому начисляем": направление, цель начисления (Отдел/Сотрудник), зависимый
 * select (отдел или сотрудник — какой из двух решает `targetType`, см. `SalaryRulesPage`), и
 * название схемы. Presentational — все значения и колбэки приходят через props, состояние черновика
 * живёт в `SalaryRulesPage` (единственном потребителе этой карточки).
 *
 * Фаза 5 (mobile adaptive): nodes `IScAL`/`AmfHy` add two mobile-only (`md:hidden`) touches to this
 * same card — a small green "обязательно" badge next to the "ШАГ 1" eyebrow, and a footer strip
 * (node `MMh80`) that reads the Step 2 rule count (`ruleCount`) and points down to it ("Список —
 * ниже"), replacing the visual continuity a two-column desktop layout gets for free. Neither adds
 * new state — `ruleCount` is just `SalaryRulesRuleList`'s own `drafts.length`, threaded through by
 * `SalaryRulesPage`.
 */
export function SalaryRulesTargetCard({
    direction,
    onDirectionChange,
    targetType,
    onTargetTypeChange,
    targetId,
    onTargetIdChange,
    targetOptions,
    isTargetOptionsLoading,
    targetOptionsError,
    schemaName,
    onSchemaNameChange,
    ruleCount,
    className,
}: SalaryRulesTargetCardProps) {
    const targetLabel = targetType === 'Department' ? 'отдел' : 'сотрудника'

    return (
        <div className={className}>
            <div className="flex w-full flex-col gap-0 rounded-[12px] border border-hairline bg-surface">
                <div className="flex flex-col gap-2.5 border-b border-hairline p-4">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                        <span className="font-ui text-[10px] font-semibold tracking-[0.8px] text-ink-muted">
                            ШАГ 1 · КОМУ НАЧИСЛЯЕМ
                        </span>
                        <span className="rounded-[6px] bg-brand-soft px-2 py-[3px] font-ui text-[11px] font-semibold text-ok-ink md:hidden">
                            обязательно
                        </span>
                    </div>
                    <div className="flex flex-col gap-[3px]">
                        <h2 className="font-display text-[17px] font-bold text-ink">Схема начисления</h2>
                        <p className="font-ui text-xs text-ink-muted">Кому начисляем и как называется схема</p>
                    </div>
                </div>

                <div className="flex flex-col gap-3.5 p-4">
                    <div className="flex flex-col gap-[7px]">
                        <span className="font-ui text-xs font-medium text-ink-muted">Направление</span>
                        <SegmentedControl
                            aria-label="Направление"
                            options={DIRECTION_OPTIONS}
                            value={direction}
                            onValueChange={onDirectionChange}
                        />
                    </div>

                    <div className="flex flex-col gap-[7px]">
                        <span className="font-ui text-xs font-medium text-ink-muted">Цель начисления</span>
                        <div className="flex flex-col gap-2">
                            <RadioCard
                                selected={targetType === 'Department'}
                                onSelect={() => onTargetTypeChange('Department')}
                                title="Отдел"
                                description="Правило действует на всех сотрудников отдела"
                            />
                            <RadioCard
                                selected={targetType === 'Employee'}
                                onSelect={() => onTargetTypeChange('Employee')}
                                title="Сотрудник"
                                description="Персональная схема для одного сотрудника"
                            />
                        </div>
                    </div>

                    <div className="flex flex-col gap-1.5">
                        <label className="font-ui text-xs font-medium text-ink-muted">
                            {targetType === 'Department' ? 'Отдел' : 'Сотрудник'}
                        </label>
                        <Select
                            value={targetId !== null ? String(targetId) : ''}
                            onValueChange={(value) => onTargetIdChange(Number(value))}
                            disabled={isTargetOptionsLoading || targetOptions.length === 0}
                        >
                            <SelectTrigger>
                                <SelectValue
                                    placeholder={
                                        isTargetOptionsLoading
                                            ? 'Загрузка...'
                                            : targetOptionsError
                                              ? 'Не удалось загрузить'
                                              : `Выберите ${targetLabel}`
                                    }
                                />
                            </SelectTrigger>
                            <SelectContent>
                                {targetOptions.map((option) => (
                                    <SelectItem key={option.id} value={String(option.id)}>
                                        {option.name}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                        {targetOptionsError && <p className="font-ui text-xs text-danger">{targetOptionsError}</p>}
                    </div>

                    <div className="flex flex-col gap-1.5">
                        <label className="font-ui text-xs font-medium text-ink-muted">Название схемы</label>
                        <Input
                            value={schemaName}
                            onChange={(event) => onSchemaNameChange(event.target.value)}
                            placeholder="Например, Мотивация сервиса · Q3 2026"
                        />
                    </div>
                </div>

                <div className="flex items-center gap-2.5 border-t border-hairline p-4 md:hidden">
                    <ListChecks className="size-4 shrink-0 text-ink-muted" />
                    <div className="flex flex-col gap-0.5">
                        <span className="font-ui text-[13px] font-semibold text-ink">
                            {ruleCount > 0 ? `В схеме ${pluralizeRules(ruleCount)} начисления` : 'В схеме пока нет правил'}
                        </span>
                        <span className="font-ui text-[11px] text-ink-muted">Список — ниже</span>
                    </div>
                </div>
            </div>
        </div>
    )
}
