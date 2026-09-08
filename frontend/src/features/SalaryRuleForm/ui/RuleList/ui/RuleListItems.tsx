import type { CatalogCategoryResponse } from 'ireports-contracts'

import type { RuleDraft } from '../../../model/ruleDraft.ts'
import { RuleFormCard, type RuleFormCardContext } from '../../RuleFormCard'
import { RuleRow } from '../../RuleRow'

export type RuleListItemsProps = {
    drafts: RuleDraft[]
    expandedId: string | null
    categories: CatalogCategoryResponse[]
    ruleFormProps: RuleFormCardContext
    onExpand: (id: string) => void
    onDelete: (id: string) => void
}

/**
 * Сам список правил: раскрытое правило рендерится как `RuleFormCard`, остальные — как свёрнутые
 * `RuleRow`. Раскрытым может быть не больше одного черновика (`expandedId`, см.
 * `core/model/useSalaryRulesDraft.ts`).
 */
export function RuleListItems({
    drafts,
    expandedId,
    categories,
    ruleFormProps,
    onExpand,
    onDelete,
}: RuleListItemsProps) {
    return (
        <div className="flex w-full flex-col gap-2.5">
            {drafts.map((draft, index) =>
                draft.draftId === expandedId ? (
                    <RuleFormCard
                        key={draft.draftId}
                        draft={draft}
                        index={index}
                        categories={categories}
                        onDelete={onDelete}
                        {...ruleFormProps}
                    />
                ) : (
                    <RuleRow
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
    )
}
