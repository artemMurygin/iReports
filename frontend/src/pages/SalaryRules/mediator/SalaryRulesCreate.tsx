import { RuleList } from '@/features/SalaryRuleForm'

import { useSalaryRulesPage } from '../model/useSalaryRulesPage.ts'
import { Layout } from '../ui/Layout'
import { MobileSaveBar } from '../ui/MobileSaveBar'
import { PageHeader } from '../ui/PageHeader'
import { SaveStatusBanner } from '../ui/SaveStatusBanner'
import { TargetCard } from '../ui/TargetCard'

/**
 * Медиатор страницы создания зарплатной схемы: вызывает единственный model-хук
 * (`model/useSalaryRulesPage.ts`) и раскладывает его плоский результат по именованным слотам
 * `ui/Layout` (frontend/CLAUDE.md, "Mediator-компонент для страниц с несколькими виджетами").
 * Собственной бизнес-логики и условного рендера здесь нет: и выбор направления, и сборка payload
 * живут в `model/` + адаптерах направлений (`service/`, `shop/`), а единственное условие показа —
 * зелёная плашка успеха — спрятано внутри самого `ui/SaveStatusBanner`.
 *
 * Классы-позиционеры слотов задаются здесь, а не внутри `Layout`: сам `Layout` не знает, что лежит
 * в слотах, и держит только раскладку страницы.
 */
export function SalaryRulesCreate() {
    const page = useSalaryRulesPage()

    const header = <PageHeader onSave={page.handleSubmit} canSave={page.canSubmit} isSubmitting={page.isSubmitting} />

    const banner = <SaveStatusBanner schemaId={page.savedSchemaId} />

    const target = (
        <TargetCard
            className="w-full md:w-[400px] md:shrink-0"
            direction={page.direction}
            onDirectionChange={page.onDirectionChange}
            targetType={page.targetType}
            onTargetTypeChange={page.onTargetTypeChange}
            targetId={page.targetId}
            onTargetIdChange={page.onTargetIdChange}
            targetOptions={page.targetOptions}
            isTargetOptionsLoading={page.isTargetOptionsLoading}
            targetOptionsError={page.targetOptionsError}
            schemaName={page.schemaName}
            onSchemaNameChange={page.onSchemaNameChange}
            ruleCount={page.ruleCount}
        />
    )

    const rules = (
        <RuleList
            className="w-full flex-1"
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
            hintText={page.mobileHintText}
            onSave={page.handleSubmit}
            canSave={page.canSubmit}
            isSubmitting={page.isSubmitting}
            onCancel={page.onResetTarget}
            canCancel={page.canResetTarget}
        />
    )

    return <Layout header={header} banner={banner} target={target} rules={rules} mobileBar={mobileBar} />
}
