import type { DepartmentReportVM } from '@/features/SalaryReportData'

import type { DepartmentDirectionBreakdown } from '../model/useDepartmentSalaryReportAll.ts'

/**
 * Финальный контракт пропсов тела отчёта отдела нового дизайна (Pencil:
 * `design/sallary-first-iteration.pen`, `wVa5g` "Зарплата отдела" — десктоп, `z5BwMk` — мобайл,
 * оба используют один и тот же вложенный узел `UO4LK`/`oJHsM` "Ledger · Зарплата отдела"). Данные —
 * тот же `DepartmentReportVM` из `features/SalaryReportData`, что и у старого
 * `pages/SalaryReport/ui/DepartmentReportBody.tsx` — состояния "не выбран"/"ошибка"/"загрузка"/
 * "пусто"/"данные" продолжают действовать 1:1, меняется только вёрстка: одна карточка-гроссбух
 * («Ledger») — общая сумма отдела наверху, ниже сотрудники ОДНИМ списком внутри той же карточки
 * (без отдельной KPI-строки + отдельной таблицы, как в старом `DepartmentTotalsKpi` +
 * `EmployeesTable`), каждая строка сотрудника — ссылка на его отдельный отчёт (см. ниже).
 *
 * `departmentName` — добавлено сверх исходного наброска контракта (Foundation-фаза): узел `wMY8e`
 * ("Итого" → "Left") показывает в "Note" не только число сотрудников и период, а и человекочитаемое
 * название отдела ("4 сотрудника · Сервисный центр · Тверская · август 2026"). Контракт отчёта
 * (`DepartmentReportVM.department`) отдаёт только числовой id, поэтому имя должно резолвиться на
 * уровне страницы из справочника `departments` (`useSalaryReportPage`/`useDepartments`) и
 * прокидываться сюда явным пропом — тот же путь, что уже пробрасывает `SalaryReportFiltersV2`
 * для `<Select>` отдела, только на один уровень глубже (через `SalaryReportBodyV2`). `null`, пока
 * справочник ещё не загрузился или отдел не найден — в этом случае "Note" просто не показывает
 * название отдела (два оставшихся сегмента, `pluralizeEmployees` + период, ничего не выдумывают).
 *
 * Проверено по узлам `UO4LK` (десктоп) и `oJHsM` (мобайл) через `mcp__pencil__execute`'s `Get`
 * (точные размеры/цвета/шрифты, а не только скриншот):
 * - `U5nJr`/`fCj1g` "Итого" — герой-строка карточки: `report.total.fact` слева (28px/700 `ink`,
 *   лейбл "Начислено по отделу · факт" 11px/600 `ink-muted`, note 12px `ink-muted`), справа —
 *   `report.total.prognose` (лейбл "Прогноз до конца месяца" + иконка `Info` 13px, значение 20px
 *   десктоп/18px мобайл `ink-muted`) и зелёный пилл-бейдж дельты ("+67 900 ₽ к факту",
 *   `bg-brand-soft`/`text-ok-ink`, копия `ERP/Atom/Badge` `PGyPp`). `report.total.prognose ===
 *   null` при `report.isClosed` — деградация в бейдж "Месяц закрыт" (`bg-warn-soft`/
 *   `text-warn-ink`), не подмена нулём/фактом (см. старую `DepartmentTotalsKpi`, тот же приём).
 *   Отрицательная дельта — тот же бейдж на `bg-danger-soft`/`text-danger`.
 * - `xPqZt`/`zWSCp` "Колонки" — заголовок таблицы: "Сотрудник · правило начисления" (жирный `ink`)
 *   / "Факт, ₽" (жирный `ink`) / "Прогноз, ₽" (medium `ink-muted`) — ОДИН раз на всю карточку (в
 *   отличие от отчёта сотрудника, где заголовок повторяется на каждое направление — здесь
 *   направление уже одно, выбрано фильтром).
 * - Строка ("Сотрудник · {name}") на каждый элемент `report.employees[]`
 *   (`DepartmentReportEmployeeVM`, он же контрактный `DepartmentSalaryReportEmployee`):
 *   аватар-инициалы + имя (16px/700) + мета "{роль} · N правил" (11px `ink-muted`), справа —
 *   `employee.total.fact`/`.prognose` (16px/700, `ink`/`ink-muted`, деградация "—" при `isClosed`) и
 *   хвостовой `ChevronRight`. Вся строка — ссылка на отдельный отчёт сотрудника
 *   (`/salaries/employee/:id`, `DepartmentEmployeeGroupV2`) — по обновлённому узлу `SozIO` (редизайн
 *   отдела) отдельного инлайн-разворота правил под строкой в отчёте отдела больше нет; тот же список
 *   правил сотрудника показан на его отдельной странице, куда и ведёт клик по строке. Это тот самый
 *   переход, ради которого задача "вся навигация через отдел сначала" и затевалась (см.
 *   `docs/salary-department-first-navigation`) — без него со страницы отдела нельзя попасть на
 *   отчёт конкретного сотрудника.
 */
export type DepartmentReportBodyV2Props = {
    /** `null`, пока отдел не выбран или отчёт ещё не загрузился (см. `isLoading`/
     * `isDepartmentSelected`). `direction` тут может быть `'all'` (вкладка «Все», сведение обоих
     * направлений на фронте, см. `useDepartmentSalaryReportAll`) — ни этот компонент, ни его дети
     * `.direction` не читают. */
    report: DepartmentReportVM | null
    /** `true` во время первичной загрузки (`isInitialLoad` из `useDepartmentSalaryReport`). */
    isLoading: boolean
    /** Сообщение реальной ошибки запроса — `null` в норме. */
    errorMessage: string | null
    /** `false`, пока пользователь не выбрал отдел в фильтрах. */
    isDepartmentSelected: boolean
    /** Человекочитаемое название выбранного отдела (`departments.find(d => d.id ===
     * departmentId)?.name`, справочник `useDepartments`) — контракт отчёта отдаёт только `id`. `null`
     * до загрузки справочника/если отдел не найден — герой-карточка тогда просто не показывает
     * сегмент названия в "Note". */
    departmentName: string | null
    /** Суммы по направлениям для Split Bar + Legend героя (`DepartmentLedgerHeroV2`) — `null`, когда
     * показывать нечего (не вкладка «Все» или сумма факта обоих направлений — 0). Просто
     * прокидывается вниз, компонент сам `.direction`/breakdown не вычисляет. */
    directionBreakdown: DepartmentDirectionBreakdown | null
    /** Клиентский текстовый фильтр по имени сотрудника (Filter Row's Search) — прокидывается в
     * `DepartmentLedgerV2`, которая фильтрует `report.employees[]` им. */
    employeeSearch: string
    className?: string
}
