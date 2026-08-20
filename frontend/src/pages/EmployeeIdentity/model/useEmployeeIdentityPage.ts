import { useState } from 'react'
import { toast } from 'sonner'
import type { CreateEmployeeIdentityRequest, EmployeeIdentityResponse, ExternalSystem } from 'ireports-contracts'

import { useEmployeeIdentities } from './useEmployeeIdentities.ts'
import { useIdentityFilters } from './useIdentityFilters.ts'
import { useIdentityMutations } from './useIdentityMutations.ts'

/**
 * Что именно открыто в модалке связи (макет `NjnJ3`). Создание помнит предзаполнение
 * (сотрудник из строки таблицы, система из колонки, по чипу «Связать» — оба), правка помнит
 * саму связь. Разные ветки — разные поля, поэтому это union, а не один объект с
 * необязательными полями: так невозможно оказаться в режиме правки без `identity`.
 */
export type IdentityFormTarget =
    | { mode: 'create'; employeeId: number | null; system: ExternalSystem | null }
    | { mode: 'edit'; identity: EmployeeIdentityResponse }

/** Сотрудник для селекта в модалке — имя + отдел, всё уже сшито в `useEmployeeIdentities`. */
export type EmployeeOption = { id: number; name: string; departmentName: string }

/** Что подтверждают в модалке удаления: сама связь + имя сотрудника для подзаголовка. */
export type DeleteTarget = { identity: EmployeeIdentityResponse; employeeName: string }

/**
 * Единственный хук страницы «Связи сотрудников» (Pencil: design/sallary-first-iteration.pen,
 * фреймы `CpVvw` — десктоп, `Tu1Fs` — мобильный). Композирует три хука по зонам
 * ответственности — данные (`useEmployeeIdentities`), локальные фильтры
 * (`useIdentityFilters`), CRUD-мутации (`useIdentityMutations`) — и добавляет к ним
 * состояние двух модалок: связи (создание/правка) и подтверждения удаления.
 *
 * Модалки не открыты одновременно намеренно: удаление вызывается из футера модалки правки, и
 * вместо вложенных диалогов правка закрывается, а её место занимает подтверждение
 * (`handleRequestDelete`) — так фокус и оверлей остаются у одного Radix Dialog.
 *
 * Возвращает плоский объект (frontend/CLAUDE.md), чтобы `EmployeeIdentityPage` осталась чистой
 * склейкой без единого условного рендера.
 */
export function useEmployeeIdentityPage() {
    const { rows, coverage, departments, isInitialLoad, isRefreshing, error, dataVersion } = useEmployeeIdentities()
    const filters = useIdentityFilters(rows)
    const { createIdentity, updateIdentity, deleteIdentity } = useIdentityMutations()

    const [formTarget, setFormTarget] = useState<IdentityFormTarget | null>(null)
    const [deleteTarget, setDeleteTarget] = useState<DeleteTarget | null>(null)

    const employeeOptions: EmployeeOption[] = rows.map((row) => ({
        id: row.employee.id,
        name: row.employee.name,
        departmentName: row.departmentName,
    }))

    function employeeName(bitrixEmployeeId: number): string {
        return rows.find((row) => row.employee.id === bitrixEmployeeId)?.employee.name ?? ''
    }

    function handleCreate() {
        setFormTarget({ mode: 'create', employeeId: null, system: null })
    }

    /** Клик по «Связать» / по плюсу в ячейке системы — сотрудник и система уже известны. */
    function handleAddIdentity(bitrixEmployeeId: number, system: ExternalSystem) {
        setFormTarget({ mode: 'create', employeeId: bitrixEmployeeId, system })
    }

    /** Действие уровня строки: та же форма, но систему сотрудник выбирает сам. */
    function handleAddForEmployee(bitrixEmployeeId: number) {
        setFormTarget({ mode: 'create', employeeId: bitrixEmployeeId, system: null })
    }

    function handleEditIdentity(identity: EmployeeIdentityResponse) {
        setFormTarget({ mode: 'edit', identity })
    }

    function handleFormOpenChange(open: boolean) {
        if (!open) setFormTarget(null)
    }

    function handleRequestDelete(identity: EmployeeIdentityResponse) {
        setFormTarget(null)
        setDeleteTarget({ identity, employeeName: employeeName(identity.bitrixEmployeeId) })
    }

    function handleDeleteOpenChange(open: boolean) {
        if (!open) setDeleteTarget(null)
    }

    /**
     * Сохранение формы. В режиме правки уходит только то, что разрешает
     * `UpdateEmployeeIdentityRequest` (сотрудник и система у существующей связи не переезжают —
     * см. контракт), поэтому форма собирает полный payload, а здесь он сужается до PATCH-тела.
     * Модалка закрывается только при успехе: на ошибке (например, дубль «сотрудник × система ×
     * тип × значение») пользователь остаётся в форме с введёнными значениями и правит их.
     */
    async function handleSubmitForm(payload: CreateEmployeeIdentityRequest) {
        try {
            if (formTarget?.mode === 'edit') {
                await updateIdentity.mutateAsync({
                    id: formTarget.identity.id,
                    payload: { identifierType: payload.identifierType, externalId: payload.externalId },
                })
                toast.success('Связь обновлена')
            } else {
                await createIdentity.mutateAsync(payload)
                toast.success('Связь создана')
            }
            setFormTarget(null)
        } catch (mutationError) {
            toast.error('Не удалось сохранить связь', {
                description: mutationError instanceof Error ? mutationError.message : String(mutationError),
            })
        }
    }

    async function handleConfirmDelete() {
        if (!deleteTarget) return

        try {
            await deleteIdentity.mutateAsync(deleteTarget.identity.id)
            toast.success('Связь удалена')
            setDeleteTarget(null)
        } catch (mutationError) {
            toast.error('Не удалось удалить связь', {
                description: mutationError instanceof Error ? mutationError.message : String(mutationError),
            })
        }
    }

    return {
        rows,
        visibleRows: filters.visibleRows,
        coverage,
        departments,
        employeeOptions,
        isInitialLoad,
        isRefreshing,
        error,
        dataVersion,
        tab: filters.tab,
        onTabChange: filters.setTab,
        departmentId: filters.departmentId,
        onDepartmentChange: filters.setDepartmentId,
        search: filters.search,
        onSearchChange: filters.setSearch,
        hasEmployees: rows.length > 0,
        hasVisibleRows: filters.visibleRows.length > 0,
        formTarget,
        onCreate: handleCreate,
        onAddIdentity: handleAddIdentity,
        onAddForEmployee: handleAddForEmployee,
        onEditIdentity: handleEditIdentity,
        onFormOpenChange: handleFormOpenChange,
        onSubmitForm: handleSubmitForm,
        isSaving: createIdentity.isPending || updateIdentity.isPending,
        deleteTarget,
        onRequestDelete: handleRequestDelete,
        onDeleteOpenChange: handleDeleteOpenChange,
        onConfirmDelete: handleConfirmDelete,
        isDeleting: deleteIdentity.isPending,
    }
}
