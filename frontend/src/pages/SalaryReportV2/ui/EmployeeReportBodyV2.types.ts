import type { EmployeeReportVM } from '@/features/SalaryReportData'

/**
 * Контракт пропсов тела отчёта сотрудника — бенто-раскладка (Pencil:
 * `design/sallary-first-iteration.pen`, узел `YCxrT` "Вариант C · Бенто-источники" — десктоп 1440,
 * `L2Ztk` "Вариант C · Моб. · Бенто-источники" — мобайл 390). Заменяет прежнюю карточку-гроссбух
 * (`LedgerCard`+`LedgerDirectionBlock`+`LedgerRoleGroup`, удалены этой правкой) четырьмя карточками,
 * которые собирает сам `EmployeeReportBodyV2.tsx`:
 * - `TotalsBentoCard` — "Итого" (тонкая обёртка вокруг переиспользованного `LedgerHero`).
 * - `TaskSourceCard` — "Источник · Задачи": объединяет `TaskCompletion`-правила ОБОИХ направлений
 *   сразу (`splitRulesByType` на каждом направлении, результаты склеены с проставленным
 *   `direction`, см. `SalaryReportRuleWithDirection`).
 * - `DirectionSourceCard` — по одной карточке на направление (только если у направления есть хоть
 *   одно НЕ-`TaskCompletion` правило), ролевые правила сгруппированы по роли (`groupRulesByRole`) +
 *   мини-тизер плана продаж направления внутри неё же.
 *
 * Детализация роли/задачи (`RuleGroupDetailsPanel`) и плана продаж (`SalesPlanDetailsPanel`)
 * открываются в боковых панелях (`shared/ui-kit/organisms/SidePanel.tsx`) — какая панель открыта и
 * с какими данными — чисто презентационный `useState` самого `EmployeeReportBodyV2` (см. её
 * комментарий), НЕ общий `useSalaryReportSelection` страницы: та больше не участвует в раскрытии
 * строк отчёта сотрудника (её `isRuleExpanded`/`onToggleRule` остаются в хуке только для отчёта
 * отдела — см. её обновлённый комментарий).
 *
 * Мобильный порядок карточек ОБЯЗАН отличаться от десктопного — "Итого" -> "Источник · Сервис" ->
 * "Источник · Магазин" -> "Источник · Задачи" на мобайле (`L2Ztk`), а на десктопе "Итого"+"Задачи" —
 * левая колонка фиксированной ширины (448px), "Сервис"+"Магазин" — правая область (`YCxrT`).
 * Реализовано двумя раздельными блоками (`xl:hidden` мобильный стек / `hidden xl:grid` десктопная
 * сетка) внутри `EmployeeReportBodyV2.tsx`, а не CSS `order` — читается проще при таком расхождении
 * группировки карточек между раскладками (не просто перестановка порядка одних и тех же соседей).
 *
 * Состояния "не выбран"/"ошибка"/"загрузка"/"пусто" — тот же контракт, что и раньше (см. историю
 * этого файла и старый `pages/SalaryReport/ui/EmployeeReportBody.tsx`) — только вёрстка карточек с
 * данными сменилась.
 */
export type EmployeeReportBodyV2Props = {
    /** Сведённый отчёт по обоим направлениям — `null`, пока сотрудник не выбран или отчёт ещё не
     * загрузился (см. `isLoading`/`isEmployeeSelected` для различения этих состояний). */
    report: EmployeeReportVM | null
    /** `true` во время первичной загрузки (`isInitialLoad` из `useEmployeeSalaryReport`) — НЕ
     * фонового рефетча, тот покрывается `RefreshTransitionLayout` на уровне страницы
     * (`ui/Layout.tsx`). */
    isLoading: boolean
    /** Сообщение реальной ошибки запроса (сеть/5xx) — `null` в норме. 404 отдельного направления
     * уже отфильтрован на уровне `features/SalaryReportData`'s `model/api.ts`/
     * `useEmployeeSalaryReport` и сюда не долетает. */
    errorMessage: string | null
    /** `false`, пока пользователь не выбрал сотрудника в фильтрах — отличает "пусто, потому что
     * ничего не выбрано" от "пусто, потому что оба направления вернули 404". */
    isEmployeeSelected: boolean
    className?: string
}
