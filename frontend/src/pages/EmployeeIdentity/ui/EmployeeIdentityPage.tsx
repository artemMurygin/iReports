import { Plus } from 'lucide-react'

import { Button } from '@/shared/ui-kit/atoms/Button'
import { PageHeader } from '@/shared/ui-kit/organisms/PageHeader'
import { useEmployeeIdentityPage } from '../model/useEmployeeIdentityPage.ts'
import { DeleteIdentityModal } from './DeleteIdentityModal.tsx'
import { EmployeeIdentityBody } from './EmployeeIdentityBody.tsx'
import { IdentityFormModal } from './IdentityFormModal'
import { Layout } from './Layout.tsx'

/**
 * Pencil: design/sallary-first-iteration.pen, фреймы `CpVvw` («Связи сотрудников · Список»,
 * десктоп, от `md:`) и `Tu1Fs` (мобильный, до `md:`); модалки — `NjnJ3` (создание/правка) и
 * `CweSL` (удаление). Маршрут — `/settings/employee-identity` (см. `app/router.tsx`).
 *
 * Чистая склейка: весь стейт (данные, фильтры, модалки, мутации) — в
 * `useEmployeeIdentityPage`, все ветвления — в `EmployeeIdentityBody`, загрузка и ошибка — в
 * `Layout`/`RefreshTransitionLayout`. Здесь только раздача пропсов по слотам.
 *
 * Модалки живут в слоте `header`, а не `body`: `body` заворачивается в
 * `RefreshTransitionLayout`, который на время фонового рефетча гасит указатель и размывает
 * содержимое — а рефетч наступает ровно в момент успешной мутации, то есть пока модалка ещё
 * может быть на экране (см. `pages/SalesPlan`, где `EditPlanModal` вынесен в `header` по той
 * же причине).
 */
export function EmployeeIdentityPage() {
    const {
        visibleRows,
        coverage,
        departments,
        employeeOptions,
        isInitialLoad,
        isRefreshing,
        error,
        dataVersion,
        tab,
        onTabChange,
        departmentId,
        onDepartmentChange,
        search,
        onSearchChange,
        hasEmployees,
        hasVisibleRows,
        rows,
        formTarget,
        onCreate,
        onAddIdentity,
        onAddForEmployee,
        onEditIdentity,
        onFormOpenChange,
        onSubmitForm,
        isSaving,
        deleteTarget,
        onRequestDelete,
        onDeleteOpenChange,
        onConfirmDelete,
        isDeleting,
    } = useEmployeeIdentityPage()

    const header = (
        <>
            <PageHeader
                breadcrumbs={[{ label: 'Настройки' }, { label: 'Связи сотрудников' }]}
                title="Связи сотрудников"
                subtitle="Кто есть кто в RemOnline и МойСкладе. Пока сотрудник не связан, его зарплата не считается."
                actions={
                    <Button type="button" onClick={onCreate} className="shrink-0">
                        <Plus />
                        Добавить связь
                    </Button>
                }
            />

            <IdentityFormModal
                target={formTarget}
                employees={employeeOptions}
                isSaving={isSaving}
                onOpenChange={onFormOpenChange}
                onSubmit={onSubmitForm}
                onDelete={onRequestDelete}
            />

            <DeleteIdentityModal
                target={deleteTarget}
                isDeleting={isDeleting}
                onOpenChange={onDeleteOpenChange}
                onConfirm={onConfirmDelete}
            />
        </>
    )

    const body = (
        <EmployeeIdentityBody
            coverage={coverage}
            departments={departments}
            tab={tab}
            onTabChange={onTabChange}
            departmentId={departmentId}
            onDepartmentChange={onDepartmentChange}
            search={search}
            onSearchChange={onSearchChange}
            visibleRows={visibleRows}
            totalCount={rows.length}
            hasEmployees={hasEmployees}
            hasVisibleRows={hasVisibleRows}
            error={error}
            isRefreshing={isRefreshing}
            onAddIdentity={onAddIdentity}
            onAddForEmployee={onAddForEmployee}
            onEditIdentity={onEditIdentity}
        />
    )

    return (
        <Layout
            isInitialLoad={isInitialLoad}
            isRefreshing={isRefreshing}
            dataVersion={dataVersion}
            error={error}
            header={header}
            body={body}
        />
    )
}
