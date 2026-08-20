import type { RuleFieldErrors } from './formNumberUtils.ts'
import type { RuleDraft } from './ruleDraft.ts'

/** Either direction's resolver (`resolveRuleDraft` for service, `resolveShopRuleDraft` for shop) —
 * both share this exact shape (`service/model/ruleFormSchema.ts`/`shop/model/ruleFormSchema.ts`), only
 * `TRule` (the contract-specific request type) differs. Generic over `TRule` (Фаза 4) so a single hook
 * implementation (`useSalaryRulesDraft.ts`) drives both directions' rule lists without merging their
 * contracts — each call site (the direction adapter, `useServiceDirection.ts`/`useShopDirection.ts`)
 * passes its own resolver and gets back a properly-typed `resolvedRules: TRule[] | null`. */
export type ResolveDraftFn<TRule> = (
    draft: RuleDraft,
) => { success: true; data: TRule } | { success: false; errors: RuleFieldErrors }

/** What `core/ui/RuleFormCard`/`core/ui/RuleList` need from a save attempt — deliberately
 * strips the resolver's `data` (the direction-specific `TRule`), which those presentational
 * components never read, so their props stay direction-agnostic instead of also becoming generic. */
export type RuleSaveOutcome = { success: true } | { success: false; errors: RuleFieldErrors }
