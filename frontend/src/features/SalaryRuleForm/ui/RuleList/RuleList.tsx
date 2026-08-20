import type { CatalogCategoryResponse } from 'ireports-contracts'

import type { RuleDraft } from '../../model/ruleDraft.ts'
import type { RuleFormCardContext } from '../RuleFormCard'

import { AddMoreRuleButton } from './ui/AddMoreRuleButton.tsx'
import { RuleListEmpty } from './ui/RuleListEmpty.tsx'
import { RuleListHeader } from './ui/RuleListHeader.tsx'
import { RuleListItems } from './ui/RuleListItems.tsx'

export type RuleListProps = {
    drafts: RuleDraft[]
    expandedId: string | null
    /** Дерево каталога: нужно и свёрнутой строке (`summarizeRuleDraft`), и полю категории в
     * раскрытой карточке. Для сервиса — всегда пустой массив. */
    categories: CatalogCategoryResponse[]
    /** Всё, что нужно только раскрытой карточке, — одним объектом, чтобы список не перечислял у
     * себя пропсы, которыми сам не пользуется (см. `core/ui/RuleFormCard`). */
    ruleFormProps: RuleFormCardContext
    onAdd: () => void
    onExpand: (id: string) => void
    onDelete: (id: string) => void
    className?: string
    /** Пробрасывается в `RuleListHeader` — см. его комментарий про разницу текста между мастером
     * создания и страницей редактирования. */
    eyebrow?: string
}

/**
 * Pencil: design/sallary-first-iteration.pen, node `tSYIw` → `Колонка · Правила` (mirrored by
 * `ZMEof` for "Магазин") — Step 2's whole right column: header (eyebrow, "N правил" counter,
 * "Добавить правило"), the list of rows (each either a collapsed `RuleRow` or, for the expanded
 * one, `RuleFormCard`), and the trailing "Добавить ещё одно правило" row (only once at least one
 * rule exists — with zero rules the header's own button is the only add entry point, avoiding two
 * near-identical CTAs on an empty list).
 *
 * Direction-agnostic since Фаза 4 — `ruleFormProps`/`categories` are threaded straight through to
 * `RuleFormCard`/`RuleRow` (see those components' file comments); this component itself has no
 * service/shop-specific logic of its own.
 */
export function RuleList({
    drafts,
    expandedId,
    categories,
    ruleFormProps,
    onAdd,
    onExpand,
    onDelete,
    className,
    eyebrow,
}: RuleListProps) {
    return (
        <div className={className}>
            <div className="flex w-full flex-col gap-3.5">
                <RuleListHeader
                    count={drafts.length}
                    isAddDisabled={expandedId !== null}
                    onAdd={onAdd}
                    eyebrow={eyebrow}
                />

                <RuleListItems
                    drafts={drafts}
                    expandedId={expandedId}
                    categories={categories}
                    ruleFormProps={ruleFormProps}
                    onExpand={onExpand}
                    onDelete={onDelete}
                />

                <AddMoreRuleButton visible={drafts.length > 0} disabled={expandedId !== null} onAdd={onAdd} />

                <RuleListEmpty visible={drafts.length === 0} />
            </div>
        </div>
    )
}
