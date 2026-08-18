import { Plus } from 'lucide-react'
import type { CatalogCategoryResponse, TargetRole } from 'ireports-contracts'

import { Button } from '@/shared/ui-kit/atoms/Button'

import { pluralizeRules } from '../model/ruleSummary.ts'
import type { RuleFormConfig } from '../model/ruleTypes.ts'
import type { RuleSaveOutcome } from '../model/useSalaryRulesDraft.ts'
import type { BorderDraft, RuleDraft, RuleType } from '../model/ruleDraft.ts'

import { SalaryRulesRuleFormCard } from './SalaryRulesRuleFormCard.tsx'
import { SalaryRulesRuleRow } from './SalaryRulesRuleRow.tsx'

export type SalaryRulesRuleListProps = {
    drafts: RuleDraft[]
    expandedId: string | null
    config: RuleFormConfig
    allowedRolesByType: Partial<Record<RuleType, TargetRole[]>>
    isRoleTypesLoading: boolean
    roleTypesError?: string | null
    categories: CatalogCategoryResponse[]
    isCategoriesLoading?: boolean
    categoriesError?: string | null
    onAdd: () => void
    onExpand: (id: string) => void
    onCancel: () => void
    onSave: () => RuleSaveOutcome | null
    onDelete: (id: string) => void
    onChange: (id: string, patch: Partial<RuleDraft>) => void
    onChangeType: (id: string, type: RuleType) => void
    onChangeBorder: (id: string, index: number, patch: Partial<BorderDraft>) => void
    className?: string
}

/**
 * Pencil: design/sallary-first-iteration.pen, node `tSYIw` → `Колонка · Правила` (mirrored by
 * `ZMEof` for "Магазин") — Step 2's whole right column: header (eyebrow, "N правил" counter,
 * "Добавить правило"), the list of rows (each either a collapsed `SalaryRulesRuleRow` or, for the
 * expanded one, `SalaryRulesRuleFormCard`), and the trailing "Добавить ещё одно правило" row (only
 * once at least one rule exists — with zero rules the header's own button is the only add entry
 * point, avoiding two near-identical CTAs on an empty list).
 *
 * Direction-agnostic since Фаза 4 — `config`/`categories` are threaded straight through to
 * `SalaryRulesRuleFormCard`/`SalaryRulesRuleRow` (see that component's file comment); this
 * component itself has no service/shop-specific logic of its own.
 */
export function SalaryRulesRuleList({
    drafts,
    expandedId,
    config,
    allowedRolesByType,
    isRoleTypesLoading,
    roleTypesError,
    categories,
    isCategoriesLoading,
    categoriesError,
    onAdd,
    onExpand,
    onCancel,
    onSave,
    onDelete,
    onChange,
    onChangeType,
    onChangeBorder,
    className,
}: SalaryRulesRuleListProps) {
    return (
        <div className={className}>
            <div className="flex w-full flex-col gap-3.5">
                <div className="flex flex-wrap items-center justify-between gap-3">
                    <div className="flex flex-col gap-1">
                        <div className="flex flex-wrap items-center gap-2">
                            <span className="font-ui text-[10px] font-semibold tracking-[0.8px] text-ink-muted">
                                ШАГ 2 · ЗА ЧТО НАЧИСЛЯЕМ
                            </span>
                            {drafts.length > 0 && (
                                <span className="rounded-[6px] bg-brand-soft px-2 py-[3px] font-ui text-[11px] font-semibold text-ok-ink">
                                    {pluralizeRules(drafts.length)}
                                </span>
                            )}
                        </div>
                        <h2 className="font-display text-[17px] font-bold text-ink">Правила расчета заработной платы</h2>
                        <p className="font-ui text-xs text-ink-muted">
                            Отдельные начисления внутри схемы: за что и в какой момент платим. Правил может быть сколько угодно.
                        </p>
                    </div>
                    <Button type="button" onClick={onAdd} disabled={expandedId !== null}>
                        <Plus />
                        Добавить правило
                    </Button>
                </div>

                <div className="flex w-full flex-col gap-2.5">
                    {drafts.map((draft, index) =>
                        draft.draftId === expandedId ? (
                            <SalaryRulesRuleFormCard
                                key={draft.draftId}
                                draft={draft}
                                index={index}
                                config={config}
                                allowedRolesByType={allowedRolesByType}
                                isRoleTypesLoading={isRoleTypesLoading}
                                roleTypesError={roleTypesError}
                                categories={categories}
                                isCategoriesLoading={isCategoriesLoading}
                                categoriesError={categoriesError}
                                onChange={(patch) => onChange(draft.draftId, patch)}
                                onChangeType={(type) => onChangeType(draft.draftId, type)}
                                onChangeBorder={(borderIndex, patch) => onChangeBorder(draft.draftId, borderIndex, patch)}
                                onCancel={onCancel}
                                onSave={onSave}
                                onDelete={() => onDelete(draft.draftId)}
                            />
                        ) : (
                            <SalaryRulesRuleRow
                                key={draft.draftId}
                                draft={draft}
                                index={index}
                                categories={categories}
                                onExpand={() => onExpand(draft.draftId)}
                                onDelete={() => onDelete(draft.draftId)}
                            />
                        ),
                    )}
                </div>

                {drafts.length > 0 && (
                    <button
                        type="button"
                        onClick={onAdd}
                        disabled={expandedId !== null}
                        className="flex w-full items-center justify-center gap-2 rounded-[10px] border border-hairline bg-canvas p-[12px_14px] font-ui text-xs font-medium text-ink-muted transition-colors hover:text-ink disabled:cursor-not-allowed disabled:opacity-50"
                    >
                        <Plus className="size-[15px]" />
                        Добавить ещё одно правило
                    </button>
                )}

                {drafts.length === 0 && (
                    <div className="flex w-full flex-col items-center gap-1 rounded-[10px] border border-dashed border-hairline p-6 text-center">
                        <p className="font-ui text-[13px] font-medium text-ink">В схеме пока нет правил</p>
                        <p className="font-ui text-xs text-ink-muted">Добавьте хотя бы одно правило начисления, чтобы сохранить схему.</p>
                    </div>
                )}
            </div>
        </div>
    )
}
