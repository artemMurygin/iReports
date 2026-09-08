import { Link } from 'react-router-dom'

import { ALL_RULE_TYPE_LABELS } from '@/kernel/ruleTypeLabels.ts'
import { pluralizeRules } from '@/kernel/pluralizeRules.ts'
import { SchemaCard } from '@/shared/ui-kit/organisms/SchemaCard'

import { formatUpdatedAt } from '../model/formatUpdatedAt.ts'
import type { MotivationSchemaListItem } from '../model/types.ts'

export type SchemaGridProps = {
    schemas: MotivationSchemaListItem[]
    className?: string
}

/**
 * Pencil: design/sallary-first-iteration.pen, node `mEYiR` (`Cards Grid`, 3 cards per row) —
 * desktop grid of `SchemaCard`s. Each cell is a plain `react-router` `Link` to
 * `/salaries/rules/:direction/:id` wrapping the card, making the whole card clickable —
 * `pages/SalaryRuleDetail`'s schema-edit screen (registered in `app/router.tsx`). `direction` is
 * part of the path (not a query param) because it selects which of the two GET/PATCH endpoint pairs
 * the edit page calls (see that page's `service/`/`shop/` model split).
 */
function SchemaGrid({ schemas, className }: SchemaGridProps) {
    return (
        <div data-slot="schema-grid" className={className}>
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
                {schemas.map((schema) => (
                    <Link
                        key={`${schema.direction}-${schema.id}`}
                        to={`/salaries/rules/${schema.direction}/${schema.id}`}
                        className="block"
                    >
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
            </div>
        </div>
    )
}

export { SchemaGrid }
