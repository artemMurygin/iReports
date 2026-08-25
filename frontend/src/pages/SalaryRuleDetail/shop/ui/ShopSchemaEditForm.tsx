import type {
    CatalogCategoryResponse,
    OrderTypeResponse,
    ShopMotivationSchemaDetailResponse,
    TargetRole,
} from 'ireports-contracts'
import { RuleList } from '@/features/SalaryRuleForm'
import type { RuleFormConfig, RuleType } from '@/features/SalaryRuleForm'

import { Layout } from '../../ui/Layout.tsx'
import { MobileSaveBar } from '../../ui/MobileSaveBar.tsx'
import { PageHeader } from '../../ui/PageHeader.tsx'
import { TargetSummaryCard } from '../../ui/TargetSummaryCard/TargetSummaryCard.tsx'
import { useShopSchemaEditForm } from '../model/useShopSchemaEditForm.ts'

export type ShopSchemaEditFormProps = {
    schema: ShopMotivationSchemaDetailResponse
    config: RuleFormConfig
    allowedRolesByType: Partial<Record<RuleType, TargetRole[]>>
    isRoleTypesLoading: boolean
    roleTypesError: string | null
    categories: CatalogCategoryResponse[]
    isCategoriesLoading: boolean
    categoriesError: string | null
    orderTypes: OrderTypeResponse[]
    isOrderTypesLoading: boolean
    orderTypesError: string | null
}

/** Зеркало `service/ui/ServiceSchemaEditForm.tsx` для направления "Магазин". */
export function ShopSchemaEditForm(props: ShopSchemaEditFormProps) {
    const page = useShopSchemaEditForm(props)

    const header = (
        <PageHeader
            schemaName={page.schemaName}
            onSave={page.handleSave}
            canSave={page.canSave}
            isSubmitting={page.isSubmitting}
        />
    )

    const target = (
        <TargetSummaryCard
            className="w-full md:w-[400px] md:shrink-0"
            direction="shop"
            targetType={page.target.type}
            targetName={page.target.name}
            schemaName={page.schemaName}
            onSchemaNameChange={page.onSchemaNameChange}
            ruleCount={page.ruleCount}
        />
    )

    const rules = (
        <RuleList
            className="w-full flex-1"
            eyebrow="ПРАВИЛА СХЕМЫ"
            drafts={page.rules.drafts}
            expandedId={page.rules.expandedId}
            categories={page.categories}
            ruleFormProps={{
                config: page.config,
                allowedRolesByType: page.allowedRolesByType,
                isRoleTypesLoading: page.isRoleTypesLoading,
                roleTypesError: page.roleTypesError,
                isCategoriesLoading: page.isCategoriesLoading,
                categoriesError: page.categoriesError,
                orderTypes: page.orderTypes,
                isOrderTypesLoading: page.isOrderTypesLoading,
                orderTypesError: page.orderTypesError,
                onChange: page.rules.updateDraft,
                onChangeType: page.rules.changeType,
                onChangeBorder: page.rules.updateBorder,
                onCancel: page.rules.cancelExpanded,
                onSave: page.rules.trySaveExpanded,
            }}
            onAdd={page.rules.addDraft}
            onExpand={page.rules.toggleExpand}
            onDelete={page.rules.removeDraft}
        />
    )

    const mobileBar = (
        <MobileSaveBar
            className="sticky bottom-[var(--bottom-nav-h,4.5rem)] z-30 mt-auto md:hidden"
            onSave={page.handleSave}
            canSave={page.canSave}
            isSubmitting={page.isSubmitting}
        />
    )

    return <Layout header={header} target={target} rules={rules} mobileBar={mobileBar} />
}
