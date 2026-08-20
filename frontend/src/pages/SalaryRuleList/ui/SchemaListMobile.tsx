import { Link } from 'react-router-dom'

import { ALL_RULE_TYPE_LABELS } from '@/kernel/ruleTypeLabels.ts'
import { pluralizeRules } from '@/kernel/pluralizeRules.ts'
import { SchemaCard } from '@/shared/ui-kit/organisms/SchemaCard'

import { formatUpdatedAt } from '../model/formatUpdatedAt.ts'
import type { MotivationSchemaListItem } from '../model/types.ts'

export type SchemaListMobileProps = {
    schemas: MotivationSchemaListItem[]
    totalCount: number
    className?: string
}

/**
 * Pencil: design/sallary-first-iteration.pen, node `QXofT` (`Cards List`) — mobile single-column
 * stack of `SchemaCard`s, plus the trailing `Qxxyc` ("Показаны N из M схем") note. The mockup's
 * static example shows 4 of 6 (a scroll/pagination affordance not otherwise specified by the PRD);
 * here it always reads "показаны {filtered} из {total}" against the real counts, since this list
 * has no client-side pagination of its own (all filtered results render). Each card links to
 * `/salaries/rules/:direction/:id`, which resolves to `pages/SalaryRuleDetail`'s edit screen — see
 * `SchemaGrid.tsx`'s comment.
 */
function SchemaListMobile({ schemas, totalCount, className }: SchemaListMobileProps) {
    return (
        <div data-slot="schema-list-mobile" className={className}>
            <div className="flex flex-col gap-2.5">
                {schemas.map((schema) => (
                    <Link key={schema.id} to={`/salaries/rules/${schema.direction}/${schema.id}`} className="block">
                        <SchemaCard
                            title={schema.name}
                            direction={schema.direction}
                            targetType={schema.targetType}
                            targetName={schema.targetName}
                            ruleTypeLabels={schema.ruleTypes.map((type) => ALL_RULE_TYPE_LABELS[type])}
                            ruleCountLabel={pluralizeRules(schema.ruleCount)}
                            updatedLabel={formatUpdatedAt(schema.updatedAt)}
                        />
                    </Link>
                ))}
                <p className="pt-1 text-center font-ui text-xs text-ink-faint">
                    Показаны {schemas.length} из {totalCount} схем
                </p>
            </div>
        </div>
    )
}

export { SchemaListMobile }
