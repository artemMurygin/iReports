import { useCallback, useMemo, useState } from 'react'

import { createRuleDraft, resetAwardFields, type BorderDraft, type RuleDraft, type RuleType } from './ruleDraft.ts'
import type { ResolveDraftFn, RuleSaveOutcome } from './ruleResolver.ts'

/** Всё, что хук отдаёт списку правил, КРОМЕ `resolvedRules` — тот типизирован контрактом направления
 * (`TRule`), нужен только адаптеру при сборке payload и не попадает в props `core/ui/RuleList`. */
export type RuleListState = Omit<ReturnType<typeof useSalaryRulesDraft<never>>, 'resolvedRules'>

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
 * Each direction adapter (Фаза 4) instantiates this hook for itself (`useServiceDirection.ts` with
 * `resolveRuleDraft`, `useShopDirection.ts` with `resolveShopRuleDraft`) rather than once shared
 * across directions — each
 * direction keeps its own independent in-progress rule list, so switching the "Направление" tab
 * never discards unsaved work in the other one (and matches the backend: one `MotivationSchema` row
 * can hold both service and shop rules, per-rule `direction`, see `ENDPOINTS.md`).
 *
 * `initialDrafts` (Фаза "Редактирование зарплатных схем") — seeds the list with drafts already
 * resolved from a loaded schema (`draftFromRule`/`draftFromShopRule`, see the direction's own
 * `ruleFormSchema.ts`) instead of starting empty. Defaults to `[]`, so schema *creation*
 * (`pages/SalaryRules`) keeps calling this with a single argument, unchanged. `pages/SalaryRuleDetail`
 * remounts the component owning this hook once the schema query resolves (a fresh `key`, not a
 * conditional hook call) rather than calling `setDrafts` after the fact — that keeps this hook's own
 * state machine free of an extra "hydrate later" transition.
 */
export function useSalaryRulesDraft<TRule>(resolve: ResolveDraftFn<TRule>, initialDrafts: RuleDraft[] = []) {
    const [drafts, setDrafts] = useState<RuleDraft[]>(initialDrafts)
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
     * `core/ui/RuleFormCard` to display inline. Returns `RuleSaveOutcome` (no `data`) — the form
     * card only needs to know success/errors, see that type's comment. */
    const trySaveExpanded = useCallback((): RuleSaveOutcome | null => {
        if (!expandedId) return null
        const draft = drafts.find((entry) => entry.draftId === expandedId)
        if (!draft) return null

        const result = resolve(draft)
        if (result.success) {
            setDrafts((prev) =>
                prev.map((entry) => (entry.draftId === expandedId ? { ...entry, confirmed: true } : entry)),
            )
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
