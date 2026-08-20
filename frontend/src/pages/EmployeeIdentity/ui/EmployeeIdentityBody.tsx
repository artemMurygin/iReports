import type { EmployeeIdentityResponse, ExternalSystem, ListDepartmentsResponse } from 'ireports-contracts'

import { Spinner } from '@/shared/ui/Spinner'

import type { EmployeeIdentityRow, IdentityCoverage } from '../model/useEmployeeIdentities.ts'
import type { IdentityTab } from '../model/useIdentityFilters.ts'
import { CoverageCard } from './CoverageCard.tsx'
import { FilterBar } from './FilterBar.tsx'
import { IdentityCardList } from './IdentityCardList.tsx'
import { IdentityEmptyState } from './IdentityEmptyState.tsx'
import { IdentityTable } from './IdentityTable.tsx'

type Props = {
    coverage: IdentityCoverage
    departments: ListDepartmentsResponse
    tab: IdentityTab
    onTabChange: (tab: IdentityTab) => void
    departmentId: string
    onDepartmentChange: (departmentId: string) => void
    search: string
    onSearchChange: (search: string) => void
    visibleRows: EmployeeIdentityRow[]
    totalCount: number
    hasEmployees: boolean
    hasVisibleRows: boolean
    error: string | null
    isRefreshing: boolean
    onAddIdentity: (bitrixEmployeeId: number, system: ExternalSystem) => void
    onAddForEmployee: (bitrixEmployeeId: number) => void
    onEditIdentity: (identity: EmployeeIdentityResponse) => void
}

/**
 * Слот `body` у `Layout` — карточка покрытия, фильтры и таблица/карточки, плюс все условия,
 * решающие, что именно показать. Вынесены сюда, чтобы `EmployeeIdentityPage` осталась чистой
 * склейкой без ветвлений (frontend/CLAUDE.md, «Медиатор/страница не должен содержать условного
 * рендера»).
 *
 * Панель фильтров живёт здесь, а не в слоте `header`, ради порядка блоков из макета `CpVvw`
 * (шапка -> покрытие -> фильтры -> таблица). Плата за это — на время фонового рефетча
 * `RefreshTransitionLayout` гасит и её вместе с таблицей; это терпимо, потому что фильтры
 * локальные и сами рефетч не вызывают: он случается только после мутации, то есть на доли
 * секунды и по инициативе самого пользователя.
 *
 * Пустых состояния два, и они не взаимозаменяемы: «в справочнике вообще нет сотрудников» —
 * это проблема интеграции с Bitrix24, а «под фильтры ничего не подошло» — приглашение
 * сбросить фильтр.
 */
export function EmployeeIdentityBody({
    coverage,
    departments,
    tab,
    onTabChange,
    departmentId,
    onDepartmentChange,
    search,
    onSearchChange,
    visibleRows,
    totalCount,
    hasEmployees,
    hasVisibleRows,
    error,
    isRefreshing,
    onAddIdentity,
    onAddForEmployee,
    onEditIdentity,
}: Props) {
    return (
        <>
            {isRefreshing && (
                <div className="flex items-center justify-end gap-1.5 font-ui text-xs text-ink-muted">
                    <Spinner className="size-3.5" />
                    Обновление данных...
                </div>
            )}

            {(!error || hasEmployees) && (
                <>
                    <CoverageCard coverage={coverage} />

                    <FilterBar
                        tab={tab}
                        onTabChange={onTabChange}
                        departments={departments}
                        departmentId={departmentId}
                        onDepartmentChange={onDepartmentChange}
                        search={search}
                        onSearchChange={onSearchChange}
                    />

                    {hasVisibleRows && (
                        <>
                            <IdentityTable
                                rows={visibleRows}
                                totalCount={totalCount}
                                onAddIdentity={onAddIdentity}
                                onAddForEmployee={onAddForEmployee}
                                onEditIdentity={onEditIdentity}
                                className="hidden md:block"
                            />
                            <IdentityCardList
                                rows={visibleRows}
                                totalCount={totalCount}
                                onAddIdentity={onAddIdentity}
                                onAddForEmployee={onAddForEmployee}
                                onEditIdentity={onEditIdentity}
                                className="md:hidden"
                            />
                        </>
                    )}

                    {/* Только про фильтры: при выключенном фильтре `visibleRows === rows`, так что
                        пустой список здесь возможен исключительно из-за фильтра — случай «строк нет
                        совсем» разбирает соседний блок ниже. */}
                    {!hasVisibleRows && hasEmployees && (
                        <IdentityEmptyState
                            title="Ничего не найдено"
                            description="Под выбранные фильтры не подошёл ни один сотрудник — измените отдел, вкладку или поисковый запрос."
                        />
                    )}

                    {!hasEmployees && (
                        <IdentityEmptyState
                            title="Сотрудники не найдены"
                            description="Справочник сотрудников Bitrix24 пуст — связывать пока некого."
                        />
                    )}
                </>
            )}
        </>
    )
}
