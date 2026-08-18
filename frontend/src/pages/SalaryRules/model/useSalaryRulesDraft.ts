import { useCallback, useMemo, useState } from 'react'

import type { RuleFieldErrors } from './formNumberUtils.ts'
import { createRuleDraft, resetAwardFields, type BorderDraft, type RuleDraft, type RuleType } from './ruleDraft.ts'

/** Either direction's resolver (`resolveRuleDraft` for service, `resolveShopRuleDraft` for shop) —
 * both share this exact shape (`ruleFormSchema.ts`/`shopRuleFormSchema.ts`), only `TRule` (the
 * contract-specific request type) differs. Generic over `TRule` (Фаза 4) so a single hook
 * implementation drives both directions' rule lists without merging their contracts — each call site
 * (`SalaryRulesPage`) passes its own direction's resolver and gets back a properly-typed
 * `resolvedRules: TRule[] | null`. */
export type ResolveDraftFn<TRule> = (draft: RuleDraft) => { success: true; data: TRule } | { success: false; errors: RuleFieldErrors }

/** What `SalaryRulesRuleFormCard`/`SalaryRulesRuleList` need from a save attempt — deliberately
 * strips the resolver's `data` (the direction-specific `TRule`), which those presentational
 * components never read, so their props stay direction-agnostic instead of also becoming generic. */
export type RuleSaveOutcome = { success: true } | { success: false; errors: RuleFieldErrors }

/**
 * Owns the Step 2 rule list: which drafts exist, which one (if any) is expanded for editing, and
 * the add/update/confirm/cancel/delete transitions between those states (Pencil `tSYIw` → `Колонка
 * · Правила` → `Список правил`: collapsed rows + at most one expanded card, "Добавить правило" /
 * "Добавить ещё одно правило" / per-card "Отмена" / "Сохранить правило").
 *
 * Invariant this hook maintains: an *unconfirmed* draft (`confirmed: false`, i.e. added but never
 * successfully saved once) only ever exists while it is the expanded one. Every place that stops a
 * draft being the expanded one — collapsing it via its own chevron, expanding a different row,
 * clicking "Отмена" — therefore also discards it if it's still unconfirmed; a confirmed draft just
 * collapses, keeping whatever edits are already in `drafts` (no separate "revert to snapshot on
 * cancel" bookkeeping — simplification: cancelling an edit to an already-saved rule closes the
 * card rather than reverting in-progress field changes).
 *
 * `SalaryRulesPage` (Фаза 4) instantiates this hook once per direction (`useSalaryRulesDraft(resolveRuleDraft)`
 * and `useSalaryRulesDraft(resolveShopRuleDraft)`) rather than once shared across directions — each
 * direction keeps its own independent in-progress rule list, so switching the "Направление" tab
 * never discards unsaved work in the other one (and matches the backend: one `MotivationSchema` row
 * can hold both service and shop rules, per-rule `direction`, see `ENDPOINTS.md`).
 */
export function useSalaryRulesDraft<TRule>(resolve: ResolveDraftFn<TRule>) {
    const [drafts, setDrafts] = useState<RuleDraft[]>([])
    const [expandedId, setExpandedId] = useState<string | null>(null)

    const discardIfUnconfirmed = useCallback((id: string) => {
        setDrafts((prev) => prev.filter((draft) => draft.draftId !== id || draft.confirmed))
    }, [])

    const addDraft = useCallback(() => {
        setExpandedId((prevExpandedId) => {
            if (prevExpandedId) discardIfUnconfirmed(prevExpandedId)
            const draft = createRuleDraft()
            setDrafts((prev) => [...prev, draft])
            return draft.draftId
        })
    }, [discardIfUnconfirmed])

    const toggleExpand = useCallback(
        (id: string) => {
            setExpandedId((prevExpandedId) => {
                if (prevExpandedId) discardIfUnconfirmed(prevExpandedId)
                return prevExpandedId === id ? null : id
            })
        },
        [discardIfUnconfirmed],
    )

    const cancelExpanded = useCallback(() => {
        setExpandedId((prevExpandedId) => {
            if (prevExpandedId) discardIfUnconfirmed(prevExpandedId)
            return null
        })
    }, [discardIfUnconfirmed])

    const removeDraft = useCallback((id: string) => {
        setDrafts((prev) => prev.filter((draft) => draft.draftId !== id))
        setExpandedId((prev) => (prev === id ? null : prev))
    }, [])

    const updateDraft = useCallback((id: string, patch: Partial<RuleDraft>) => {
        setDrafts((prev) => prev.map((draft) => (draft.draftId === id ? { ...draft, ...patch } : draft)))
    }, [])

    const changeType = useCallback((id: string, nextType: RuleType) => {
        setDrafts((prev) => prev.map((draft) => (draft.draftId === id ? resetAwardFields(draft, nextType) : draft)))
    }, [])

    const updateBorder = useCallback((id: string, index: number, patch: Partial<BorderDraft>) => {
        setDrafts((prev) =>
            prev.map((draft) =>
                draft.draftId === id
                    ? {
                          ...draft,
                          percentBorders: draft.percentBorders.map((border, borderIndex) =>
                              borderIndex === index ? { ...border, ...patch } : border,
                          ),
                      }
                    : draft,
            ),
        )
    }, [])

    /** "Сохранить правило" — validates the currently-expanded draft; on success marks it
     * `confirmed` and collapses it, on failure leaves it expanded and returns the field errors for
     * `SalaryRulesRuleFormCard` to display inline. Returns `RuleSaveOutcome` (no `data`) — the form
     * card only needs to know success/errors, see that type's comment. */
    const trySaveExpanded = useCallback((): RuleSaveOutcome | null => {
        if (!expandedId) return null
        const draft = drafts.find((entry) => entry.draftId === expandedId)
        if (!draft) return null

        const result = resolve(draft)
        if (result.success) {
            setDrafts((prev) => prev.map((entry) => (entry.draftId === expandedId ? { ...entry, confirmed: true } : entry)))
            setExpandedId(null)
            return { success: true }
        }
        return result
    }, [drafts, expandedId, resolve])

    const allDraftsValid = useMemo(
        () => drafts.length > 0 && drafts.every((draft) => resolve(draft).success),
        [drafts, resolve],
    )

    const resolvedRules = useMemo(() => {
        const results = drafts.map((draft) => resolve(draft))
        return results.every((result) => result.success)
            ? results.map((result) => (result as Extract<typeof result, { success: true }>).data)
            : null
    }, [drafts, resolve])

    return {
        drafts,
        expandedId,
        addDraft,
        toggleExpand,
        cancelExpanded,
        removeDraft,
        updateDraft,
        changeType,
        updateBorder,
        trySaveExpanded,
        allDraftsValid,
        resolvedRules,
    }
}
