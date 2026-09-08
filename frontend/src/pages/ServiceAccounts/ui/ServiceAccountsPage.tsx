import { Search } from 'lucide-react'

import { Input } from '@/shared/ui-kit/atoms/Input'
import { PageHeader } from '@/shared/ui-kit/organisms/PageHeader'

import { useServiceAccountsPage } from '../model/useServiceAccountsPage.ts'
import { Layout } from './Layout.tsx'
import { ServiceAccountsList } from './ServiceAccountsList.tsx'

/**
 * Страница настроек «Служебные аккаунты» (docs/employee-ordering-and-salary-filter, Фаза 4).
 * Маршрут — `/settings/service-accounts` (см. `app/router.tsx`), второй пункт раздела
 * «Настройки» рядом со «Связи сотрудников» (`app/navigation.tsx`).
 *
 * Позволяет отметить/снять отметку «служебный» у любого сотрудника — переключатель сразу
 * вызывает `PATCH /v1/directory/employees/:id/service-account` (Фаза 3) и показывает эффект:
 * отмеченные сотрудники исчезают из отчёта по зарплате, взаиморасчётов, зарплатных схем и
 * справочника выбора сотрудника, но остаются видны в графике работы и на странице «Связи
 * сотрудников» — это сознательно НЕ поведение самой этой страницы, а backend-фильтрация
 * (Фаза 3), эта страница только переключает признак и отображает его текущее состояние.
 *
 * Чистая склейка (frontend/CLAUDE.md, «Mediator-компонент для страниц с несколькими
 * виджетами») — весь стейт и обработчики в `useServiceAccountsPage`.
 */
export function ServiceAccountsPage() {
    const {
        visibleRows,
        totalCount,
        excludedCount,
        search,
        onSearchChange,
        isInitialLoad,
        isRefreshing,
        error,
        hasEmployees,
        hasVisibleRows,
        pendingEmployeeId,
        onToggle,
    } = useServiceAccountsPage()

    const subtitle =
        excludedCount > 0
            ? `Служебные аккаунты не считаются в зарплате. Сейчас исключено: ${excludedCount} из ${totalCount}.`
            : 'Отметьте служебный (нерабочий) аккаунт, чтобы исключить его из зарплатных отчётов и расчётов.'

    const header = (
        <>
            <PageHeader title="Служебные аккаунты" subtitle={subtitle} />

            <div className="relative w-full md:max-w-xs">
                <Search className="pointer-events-none absolute top-1/2 left-3 size-[15px] -translate-y-1/2 text-ink-faint" />
                <Input
                    value={search}
                    onChange={(event) => onSearchChange(event.target.value)}
                    placeholder="Поиск по имени"
                    className="pl-9"
                    aria-label="Поиск сотрудника"
                />
            </div>
        </>
    )

    const body = (
        <ServiceAccountsList
            rows={visibleRows}
            totalCount={totalCount}
            hasEmployees={hasEmployees}
            hasVisibleRows={hasVisibleRows}
            pendingEmployeeId={pendingEmployeeId}
            onToggle={onToggle}
        />
    )

    return (
        <Layout isInitialLoad={isInitialLoad} isRefreshing={isRefreshing} error={error} header={header} body={body} />
    )
}
