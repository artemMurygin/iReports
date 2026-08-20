import { useCallback, useMemo, useState } from 'react'

import { useDepartments, useEmployees, type TargetOption } from '@/features/TargetDirectory'

import { useServiceDirection } from '../service'
import { useShopDirection } from '../shop'

import type { SchemaDirection } from './types.ts'
import { useSchemaTarget } from './useSchemaTarget.ts'

/**
 * Композиция всей страницы создания зарплатной схемы: направление + Шаг 1 (`useSchemaTarget`) +
 * оба адаптера направлений. Возвращает плоский объект, которого медиатору хватает целиком —
 * `mediator/SalaryRulesCreate.tsx` только раскладывает его по слотам `ui/Layout`, ничего не
 * вычисляя (frontend/CLAUDE.md, "model-хуки с плоским объектом состояния").
 *
 * Оба адаптера вызываются безусловно (правила хуков), так что у каждого направления свой
 * независимый черновик: переключение "Направления" меняет только то, какой список показан, и
 * никогда не выбрасывает несохранённую работу в другом (см. `useSalaryRulesDraft.ts`). Обе мутации
 * по этой же причине живут одновременно, поэтому `isSubmitting` — их дизъюнкция, как и было в
 * дорефакторной `SalaryRulesPage` (`createSchema.isPending || createShopSchema.isPending`): кнопка
 * "Сохранить схему" блокируется на время любой из двух отправок.
 */
export function useSalaryRulesPage() {
    const [direction, setDirection] = useState<SchemaDirection>('service')
    const target = useSchemaTarget()

    const departmentsQuery = useDepartments()
    const employeesQuery = useEmployees()

    const service = useServiceDirection()
    const shop = useShopDirection()

    /** Единственное сравнение направлений во всём модуле — дальше страница работает только с
     * `active`, форма которого одинакова у обоих направлений (`DirectionAdapter`). */
    const active = direction === 'service' ? service : shop

    const targetOptions: TargetOption[] = useMemo(() => {
        if (target.targetType === 'Department') return departmentsQuery.data ?? []
        return employeesQuery.data ?? []
    }, [target.targetType, departmentsQuery.data, employeesQuery.data])

    const isTargetOptionsLoading =
        target.targetType === 'Department' ? departmentsQuery.isLoading : employeesQuery.isLoading
    const targetOptionsError =
        (target.targetType === 'Department' ? departmentsQuery.error : employeesQuery.error)?.message ?? null

    const isSubmitting = service.isSubmitting || shop.isSubmitting
    const canSubmit =
        target.targetId !== null && target.schemaName.trim().length > 0 && active.rules.allDraftsValid && !isSubmitting

    const { targetType, targetId, schemaName } = target
    const submit = active.submit

    const handleSubmit = useCallback(() => {
        if (!canSubmit || targetId === null) return
        submit({ targetType, targetId, name: schemaName.trim() })
    }, [canSubmit, schemaName, submit, targetId, targetType])

    const savedSchemaId = active.savedSchemaId
    const mobileHintText = savedSchemaId ? `Схема сохранена, ID: ${savedSchemaId}` : 'Черновик · схема ещё не сохранена'

    return {
        direction,
        onDirectionChange: setDirection,

        targetType: target.targetType,
        onTargetTypeChange: target.handleTargetTypeChange,
        targetId: target.targetId,
        onTargetIdChange: target.handleTargetIdChange,
        schemaName: target.schemaName,
        onSchemaNameChange: target.handleSchemaNameChange,
        onResetTarget: target.reset,
        canResetTarget: target.canReset,

        targetOptions,
        isTargetOptionsLoading,
        targetOptionsError,

        config: active.config,
        rules: active.rules,
        allowedRolesByType: active.allowedRolesByType,
        isRoleTypesLoading: active.isRoleTypesLoading,
        roleTypesError: active.roleTypesError,
        categories: active.categories,
        isCategoriesLoading: active.isCategoriesLoading,
        categoriesError: active.categoriesError,
        ruleCount: active.rules.drafts.length,

        canSubmit,
        isSubmitting,
        savedSchemaId,
        handleSubmit,
        mobileHintText,
    }
}
