import { useMemo, useState } from 'react'
import { Check, Loader2 } from 'lucide-react'
import type { MotivationRequest, ShopMotivationRequest, TargetRole } from 'ireports-contracts'
import { toast } from 'sonner'

import { Button } from '@/shared/ui-kit/atoms/Button'

import { useCatalog } from '../model/useCatalog.ts'
import { useCreateMotivationSchema } from '../model/useCreateMotivationSchema.ts'
import { useCreateShopMotivationSchema } from '../model/useCreateShopMotivationSchema.ts'
import { useDepartments, useEmployees } from '../model/useTargetDirectory.ts'
import { useSalaryRuleTypes } from '../model/useSalaryRuleTypes.ts'
import { useShopSalaryRuleTypes } from '../model/useShopSalaryRuleTypes.ts'
import { useSalaryRulesDraft } from '../model/useSalaryRulesDraft.ts'
import { resolveRuleDraft } from '../model/ruleFormSchema.ts'
import { resolveShopRuleDraft } from '../model/shopRuleFormSchema.ts'
import { SERVICE_RULE_FORM_CONFIG } from '../model/ruleTypes.ts'
import { SHOP_RULE_FORM_CONFIG } from '../model/shopRuleTypes.ts'
import type { RuleType } from '../model/ruleDraft.ts'
import type { SchemaDirection } from '../model/types.ts'

import { SalaryRulesMobileSaveBar } from './SalaryRulesMobileSaveBar.tsx'
import { SalaryRulesRuleList } from './SalaryRulesRuleList.tsx'
import { SalaryRulesTargetCard, type TargetOption } from './SalaryRulesTargetCard.tsx'

type TargetType = MotivationRequest['targetType']

/**
 * Pencil: design/sallary-first-iteration.pen, node `tSYIw` (`Зарплатное правило · Создание
 * (Сервис)`, desktop) + `l0o4nP` (`Пороги · Развёрнуто`) for "Сервис", `ZMEof` (`Зарплатное правило
 * · Создание (Магазин)`) + `vtDMA` (`Категория товара · Выпадающее меню`) for "Магазин" — full
 * desktop schema-creation form for both directions (Фаза 4, docs/salary-schema-creation-ui).
 *
 * Step 1 (`SalaryRulesTargetCard`) is shared as-is between directions: `targetType`/`targetId`
 * (Отдел/Сотрудник) come from the same direction-agnostic Bitrix directory (`useTargetDirectory.ts`)
 * and the same `motivation_schemas` row can hold both directions' rules (find-or-create by
 * `(targetType, targetId)`, `direction` lives per-rule — see `ENDPOINTS.md`), so only `direction`
 * itself needs page state.
 *
 * Step 2 is where the two directions actually diverge: TWO independent `useSalaryRulesDraft`
 * instances (one per direction, each with its own resolver — `resolveRuleDraft`/
 * `resolveShopRuleDraft` — and its own `RuleFormConfig` — `SERVICE_RULE_FORM_CONFIG`/
 * `SHOP_RULE_FORM_CONFIG`), so switching the "Направление" tab swaps which list is shown/edited
 * without discarding unsaved work in the other one (see `useSalaryRulesDraft.ts`'s file comment).
 * "Сохранить схему" always submits only the currently selected direction's rules, to its own
 * endpoint (`POST /v1/service/motivation-schema` vs `POST /v1/shop/accounting/motivation-schema`) —
 * the two contracts (`MotivationRequestSchema`/`ShopMotivationRequestSchema`) are never merged into
 * one request.
 *
 * Фаза 5 (mobile adaptive, docs/salary-schema-creation-ui): nodes `IScAL`/`AmfHy` stack Step 1 and
 * Step 2 into one column below `md:` (the desktop `md:flex-row` split already does this — see the
 * layout below) and move "Сохранить схему" into a sticky bottom bar
 * (`SalaryRulesMobileSaveBar`, `md:hidden`) instead of the header's own button (`hidden md:inline-flex`
 * on that one). The bar is deliberately the LAST child of `<main>`, with `mt-auto` on it — see that
 * component's own comment for why this, combined with `main` being `flex-1`, is what makes it stack
 * flush above the global `BottomNav` without any hardcoded height offset. "Отмена" in that bar
 * resets only Step 1's target fields (`handleResetTarget`), not the rule drafts — see the bar's
 * comment.
 */
export function SalaryRulesPage() {
    const [direction, setDirection] = useState<SchemaDirection>('service')
    const [targetType, setTargetType] = useState<TargetType>('Department')
    const [targetId, setTargetId] = useState<number | null>(null)
    const [schemaName, setSchemaName] = useState('')

    const departmentsQuery = useDepartments()
    const employeesQuery = useEmployees()
    const ruleTypesQuery = useSalaryRuleTypes()
    const shopRuleTypesQuery = useShopSalaryRuleTypes()
    const catalogQuery = useCatalog()
    const createSchema = useCreateMotivationSchema()
    const createShopSchema = useCreateShopMotivationSchema()

    const serviceRulesDraft = useSalaryRulesDraft(resolveRuleDraft)
    const shopRulesDraft = useSalaryRulesDraft(resolveShopRuleDraft)
    const rulesDraft = direction === 'service' ? serviceRulesDraft : shopRulesDraft

    const targetOptions: TargetOption[] = useMemo(() => {
        if (targetType === 'Department') return departmentsQuery.data ?? []
        return employeesQuery.data ?? []
    }, [targetType, departmentsQuery.data, employeesQuery.data])

    const isTargetOptionsLoading =
        targetType === 'Department' ? departmentsQuery.isLoading : employeesQuery.isLoading
    const targetOptionsError =
        (targetType === 'Department' ? departmentsQuery.error : employeesQuery.error)?.message ?? null

    const activeRuleTypesQuery = direction === 'service' ? ruleTypesQuery : shopRuleTypesQuery
    const allowedRolesByType = useMemo(() => {
        const map: Partial<Record<RuleType, TargetRole[]>> = {}
        for (const entry of activeRuleTypesQuery.data ?? []) {
            map[entry.type as RuleType] = entry.allowedRoles
        }
        return map
    }, [activeRuleTypesQuery.data])

    const config = direction === 'service' ? SERVICE_RULE_FORM_CONFIG : SHOP_RULE_FORM_CONFIG
    const categories = catalogQuery.data ?? []

    function handleTargetTypeChange(nextType: TargetType) {
        setTargetType(nextType)
        setTargetId(null)
    }

    const canResetTarget = targetId !== null || schemaName.trim().length > 0

    /** Mobile sticky bar's "Отмена" — see `SalaryRulesMobileSaveBar`'s comment on why this resets
     * only Step 1's own fields, not `rulesDraft`. */
    function handleResetTarget() {
        setTargetId(null)
        setSchemaName('')
    }

    const isSubmitting = createSchema.isPending || createShopSchema.isPending
    const canSubmit =
        targetId !== null && schemaName.trim().length > 0 && rulesDraft.allDraftsValid && !isSubmitting

    function handleSubmit() {
        if (!canSubmit || targetId === null) return

        if (direction === 'service') {
            if (!serviceRulesDraft.resolvedRules) return
            const payload: MotivationRequest = {
                targetType,
                targetId,
                name: schemaName.trim(),
                rules: serviceRulesDraft.resolvedRules,
            }
            createSchema.mutate(payload, {
                onSuccess: (response) => {
                    toast.success('Зарплатная схема сервиса сохранена', { description: `ID схемы: ${response.id}` })
                },
                onError: (error) => {
                    toast.error('Не удалось сохранить схему', { description: error.message })
                },
            })
        } else {
            if (!shopRulesDraft.resolvedRules) return
            const payload: ShopMotivationRequest = {
                targetType,
                targetId,
                name: schemaName.trim(),
                rules: shopRulesDraft.resolvedRules,
            }
            createShopSchema.mutate(payload, {
                onSuccess: (response) => {
                    toast.success('Зарплатная схема магазина сохранена', { description: `ID схемы: ${response.id}` })
                },
                onError: (error) => {
                    toast.error('Не удалось сохранить схему', { description: error.message })
                },
            })
        }
    }

    const successId =
        direction === 'service'
            ? createSchema.isSuccess
                ? createSchema.data.id
                : null
            : createShopSchema.isSuccess
              ? createShopSchema.data.id
              : null

    const mobileHintText = successId ? `Схема сохранена, ID: ${successId}` : 'Черновик · схема ещё не сохранена'

    return (
        <main className="flex flex-1 flex-col bg-canvas">
            <div className="flex flex-col gap-4 px-4 py-5 md:px-7 md:py-6">
                <div className="flex flex-wrap items-center justify-between gap-4">
                    <div className="flex flex-col gap-1">
                        <h1 className="font-display text-[20px] font-bold tracking-[-0.3px] text-ink">
                            Новая зарплатная схема
                        </h1>
                        <p className="font-ui text-[13px] text-ink-muted">
                            Схема определяет, кому начисляем, и содержит правила начисления.
                        </p>
                    </div>

                    <Button onClick={handleSubmit} disabled={!canSubmit} className="hidden md:inline-flex">
                        {isSubmitting ? <Loader2 className="animate-spin" /> : <Check />}
                        Сохранить схему
                    </Button>
                </div>

                {successId && (
                    <div className="flex items-center gap-2 rounded-[10px] border border-brand-border bg-brand-soft p-[11px] font-ui text-[13px] text-ok-ink">
                        <Check className="size-[15px] shrink-0" />
                        Схема сохранена, ID: {successId}
                    </div>
                )}

                <div className="flex w-full flex-col gap-5 md:flex-row md:items-start">
                    <SalaryRulesTargetCard
                        className="w-full md:w-[400px] md:shrink-0"
                        direction={direction}
                        onDirectionChange={setDirection}
                        targetType={targetType}
                        onTargetTypeChange={handleTargetTypeChange}
                        targetId={targetId}
                        onTargetIdChange={setTargetId}
                        targetOptions={targetOptions}
                        isTargetOptionsLoading={isTargetOptionsLoading}
                        targetOptionsError={targetOptionsError}
                        schemaName={schemaName}
                        onSchemaNameChange={setSchemaName}
                        ruleCount={rulesDraft.drafts.length}
                    />

                    <SalaryRulesRuleList
                        className="w-full flex-1"
                        drafts={rulesDraft.drafts}
                        expandedId={rulesDraft.expandedId}
                        config={config}
                        allowedRolesByType={allowedRolesByType}
                        isRoleTypesLoading={activeRuleTypesQuery.isLoading}
                        roleTypesError={activeRuleTypesQuery.error?.message ?? null}
                        categories={categories}
                        isCategoriesLoading={direction === 'shop' && catalogQuery.isLoading}
                        categoriesError={direction === 'shop' ? (catalogQuery.error?.message ?? null) : null}
                        onAdd={rulesDraft.addDraft}
                        onExpand={rulesDraft.toggleExpand}
                        onCancel={rulesDraft.cancelExpanded}
                        onSave={rulesDraft.trySaveExpanded}
                        onDelete={rulesDraft.removeDraft}
                        onChange={rulesDraft.updateDraft}
                        onChangeType={rulesDraft.changeType}
                        onChangeBorder={rulesDraft.updateBorder}
                    />
                </div>
            </div>

            <SalaryRulesMobileSaveBar
                className="sticky bottom-0 z-30 mt-auto md:hidden"
                hintText={mobileHintText}
                onSave={handleSubmit}
                canSave={canSubmit}
                isSubmitting={isSubmitting}
                onCancel={handleResetTarget}
                canCancel={canResetTarget}
            />
        </main>
    )
}
