import { useCallback, useState } from 'react'
import type {
    CatalogCategoryResponse,
    OrderTypeResponse,
    ShopMotivationSchemaDetailResponse,
    TargetRole,
} from 'ireports-contracts'
import { toast } from 'sonner'
import { useNavigate } from 'react-router-dom'
import { useQueryClient } from '@tanstack/react-query'

import {
    draftFromShopRule,
    resolveShopRuleDraft,
    useSalaryRulesDraft,
    useTaskLinkPanels,
    type RuleFormConfig,
    type RuleType,
    type WarehouseFieldWarehouse,
} from '@/features/SalaryRuleForm'

import { api } from './api.ts'
import { useUpdateMotivationSchema } from './useUpdateMotivationSchema.ts'
import { useDeleteMotivationSchema } from './useDeleteMotivationSchema.ts'

export type UseShopSchemaEditFormArgs = {
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
    warehouses: WarehouseFieldWarehouse[]
    isWarehousesLoading: boolean
    warehousesError: string | null
}

/** Зеркало `service/model/useServiceSchemaEditForm.ts` — та же "фаза формы", смонтированная только
 * после загрузки `schema`, тот же принцип `initialDrafts`/отсутствия ре-синхронизации на фоновый
 * рефетч (см. этого хука комментарий). */
export function useShopSchemaEditForm({
    schema,
    config,
    allowedRolesByType,
    isRoleTypesLoading,
    roleTypesError,
    categories,
    isCategoriesLoading,
    categoriesError,
    orderTypes,
    isOrderTypesLoading,
    orderTypesError,
    warehouses,
    isWarehousesLoading,
    warehousesError,
}: UseShopSchemaEditFormArgs) {
    const navigate = useNavigate()
    const queryClient = useQueryClient()
    const [schemaName, setSchemaName] = useState(schema.name)
    const [isDeleteDialogOpen, setDeleteDialogOpen] = useState(false)
    const rules = useSalaryRulesDraft(resolveShopRuleDraft, schema.rules.map(draftFromShopRule))
    const updateSchema = useUpdateMotivationSchema(schema.id)
    const deleteSchema = useDeleteMotivationSchema(schema.id)

    const { resolvedRules } = rules
    const canSave = schemaName.trim().length > 0 && rules.allDraftsValid && !updateSchema.isPending

    // replace-bitrix-task-integration — зеркало `service/model/useServiceSchemaEditForm.ts`'s
    // `taskPanels` (обе стороны делят одну и ту же `useTaskLinkPanels`).
    const taskPanels = useTaskLinkPanels(rules.updateDraft)

    // TaskCompletion можно завести только на схему конкретного сотрудника (backend
    // CreateShopSalaryRuleHandler бросает TaskCompletionRequiresPersonalSchemaException для схемы
    // отдела) — на схеме отдела пункт убирается из дропдауна «Тип правила» при редактировании,
    // зеркало `service/model/useServiceSchemaEditForm.ts`.
    const visibleConfig: RuleFormConfig =
        schema.target.type === 'Department'
            ? { ...config, ruleTypeOrder: config.ruleTypeOrder.filter((type) => type !== 'TaskCompletion') }
            : config

    const handleSave = useCallback(() => {
        if (!canSave || !resolvedRules) return
        updateSchema.mutate(
            { name: schemaName.trim(), rules: resolvedRules },
            {
                onSuccess: () => {
                    taskPanels.markTasksSaved()
                    toast.success('Изменения сохранены')
                    navigate('/salaries/rules')
                },
                onError: (error) => {
                    toast.error('Не удалось сохранить схему', { description: error.message })
                },
            },
        )
    }, [canSave, navigate, resolvedRules, schemaName, taskPanels, updateSchema])

    // add-task-rule-task-lifecycle — зеркало `service/model/useServiceSchemaEditForm.ts`'s
    // `onDeleteRule`.
    const onDeleteRule = useCallback(
        async (ruleId: string) => {
            await api.deleteSalaryRule(ruleId)
            queryClient.invalidateQueries({ queryKey: ['motivation-schema', 'shop', schema.id] })
        },
        [queryClient, schema.id],
    )

    // Зеркало `service/model/useServiceSchemaEditForm.ts`'s `onDeactivateRule`.
    const onDeactivateRule = useCallback(
        async (ruleId: string) => {
            await api.deactivateSalaryRule(ruleId)
            queryClient.invalidateQueries({ queryKey: ['motivation-schema', 'shop', schema.id] })
        },
        [queryClient, schema.id],
    )

    const handleDelete = useCallback(() => {
        deleteSchema.mutate(undefined, {
            onSuccess: () => {
                toast.success('Схема удалена')
                navigate('/salaries/rules')
            },
        })
    }, [deleteSchema, navigate])

    return {
        schemaName,
        onSchemaNameChange: setSchemaName,
        target: schema.target,
        ruleCount: rules.drafts.length,
        rules,
        onOpenTask: taskPanels.openTask,
        onCreateTask: taskPanels.requestCreateTask,
        openTaskId: taskPanels.openTaskId,
        closeTaskDetails: taskPanels.closeTaskDetails,
        isCreatingTask: taskPanels.isCreatingTask,
        cancelCreateTask: taskPanels.cancelCreateTask,
        handleTaskCreated: taskPanels.handleTaskCreated,
        onDeleteRule,
        onDeactivateRule,
        config: visibleConfig,
        allowedRolesByType,
        isRoleTypesLoading,
        roleTypesError,
        categories,
        isCategoriesLoading,
        categoriesError,
        orderTypes,
        isOrderTypesLoading,
        orderTypesError,
        warehouses,
        isWarehousesLoading,
        warehousesError,
        canSave,
        isSubmitting: updateSchema.isPending,
        handleSave,
        isDeleteDialogOpen,
        openDeleteDialog: useCallback(() => setDeleteDialogOpen(true), []),
        onDeleteDialogOpenChange: setDeleteDialogOpen,
        handleDelete,
        isDeleting: deleteSchema.isPending,
        deleteError: deleteSchema.error?.message ?? null,
    }
}
