import type { EmployeeReportVM, SalaryDirection } from '@/features/SalaryReportData'

/**
 * Контракт пропсов тела отчёта сотрудника нового дизайна (Pencil:
 * `design/sallary-first-iteration.pen`, `wLtzp` "Зарплата сотрудника" — десктоп, `b63e8p` — мобайл).
 * Данные — те же `EmployeeReportVM` из `features/SalaryReportData`, что и у старого
 * `pages/SalaryReport/ui/EmployeeReportBody.tsx` (тот же расчёт, тот же бэкенд, см.
 * `EmployeeReportBody.types.ts`'s комментарий — все правила состояний "не выбран"/"ошибка"/
 * "загрузка"/"пусто"/"данные" продолжают действовать 1:1). Меняется только вёрстка: вместо
 * отдельных KPI-карточек + вкладок/секций направлений — ОДНА карточка-гроссбух («Ledger ·
 * Зарплата», узел `H7Mz74`), где общая сумма — верхняя строка карточки, а направления идут ниже
 * внутри неё же, каждое своим блоком, без явных табов в шапке страницы.
 *
 * Разметка узла `H7Mz74` для UI-фазы (используй `mcp__pencil__get_screenshot`/`get_app_state` +
 * `execute`'s `Get` на этих id, чтобы сверить точные размеры/цвета/отступы):
 * - `Y8Cgy` "Итого" — герой-строка карточки: `report.grandTotal.fact` слева ("Начислено всего ·
 *   факт", нота "Сервис + Магазин · {период}", те же данные, что раньше показывала
 *   `SalaryTotalsKpi`), `report.grandTotal.prognose` справа ("Прогноз до конца месяца" + иконка
 *   инфо `F43Q9` + компонент "Дельта" `Pkp9B`, вероятно `ERP/Atom/…` реф — открой инстанс, чтобы
 *   узнать конкретный компонент). `grandTotal.prognose === null` (см. `EmployeeReportVM`'s
 *   комментарий — истинно, если хотя бы одно присутствующее направление закрыто) — та же
 *   деградация в "Месяц закрыт"/warn-тон, что была в `SalaryTotalsKpi`, а не подмена нулём/фактом.
 * - На каждый элемент `report.directions[]` (`DirectionReportVM`) — пара блоков:
 *   - `fNwhK` "Направление · {label}" — заголовок блока: иконка направления (сервис/магазин, как в
 *     `DirectionSection`'s `DIRECTION_ICONS`), `direction.label`, мета "· N правил"
 *     (`direction.rules.length`, `pluralizeRules` из `kernel/pluralizeRules.ts`), справа —
 *     `direction.total.fact`/`direction.total.prognose` (та же деградация "Месяц закрыт" при
 *     `direction.isClosed` && `total.prognose === null`, см. старую `DirectionSection`). Бейдж
 *     статуса начисления (`direction.accrualStatus`, см. `AccrualStatusBadge` в
 *     `features/SalaryAccruals`) сюда тоже переносится — в старом дизайне жил в этом же заголовке.
 *   - `Fbvla` "Колонки · {label}" — заголовок таблицы правил направления: "Правило начисления" /
 *     "Факт, ₽" / "Прогноз, ₽" (без отдельной колонки %, факт→прогноз, как в старом
 *     `RulesTable` — в новом макете процент показан внутри строки правила).
 *   - Одна строка `cyS5Q`-подобная ("Правило · {name}") на каждый элемент `direction.rules[]`
 *     (`SalaryReportRule`): `Строка` — точка-индикатор (`Dot`, вероятно цвет по
 *     `isFloatPercentRule(rule)`, см. `features/SalaryReportData`) + `rule.name` + мета
 *     ("Плавающий процент · KPI" / "Фиксированная ставка", как в старом `RulesTable`'s
 *     `metaLabel`), справа — `rule.amount.fact` + "Ставка" (`formatFloatPercentRange(rule,
 *     direction.isClosed)` для KPI-правил, либо текст вида "1 200 ₽ × 24" для фиксированных — см.
 *     сэмплы `naUlS`/`KPxqG`/`HAhJE`, бэкенд отдаёт их только неявно через `rule.amount`/
 *     `rule.appliedPercent`, форматирование "N ₽ × M" — вывод UI-фазы, не контрактное поле) и
 *     `rule.amount.prognose`. Строка разворачивается (`isRuleExpanded`/`onToggleRule`, ключ
 *     `${direction.direction}:${rule.ruleId}` — та же схема ключей, что в старом `RulesTable`) в
 *     "Детализация" (`oea4S`) — табличный "Rail" (`uU8GI`) вместо старой карточной `RuleSources`:
 *     подзаголовок "Документ / Устройство-работа / Факт, ₽ / Прогноз, ₽", затем по одной строке на
 *     каждый видимый `rule.sources[]` (документ = `source.label ?? '#' + source.id`, ссылка
 *     `source.link`, позиция — человекочитаемое описание, которого в контракте НЕТ отдельным полем
 *     — UI-фаза сама решает, что показывать вторым столбцом, например снова `source.label`/тип), и
 *     завершающая строка "Остаток" (`pa6r6`) — "ещё N заказов" (`sources.length -
 *     DEFAULT_VISIBLE_COUNT`, тот же приём "показать все", что в старой `RuleSources`) + сумма
 *     прогноза по невидимым источникам (контракт этого агрегата не отдаёт отдельно — либо считать
 *     на фронте как остаток `rule.amount.prognose` минус сумма видимых `source.amount.prognose`,
 *     либо просто не показывать сумму на "Остатке", если это не разойдётся с макетом).
 * - Карточки плана продаж (`EG4ns`/`xPXmo` "План продаж · Сервис/Магазин") остаются отдельной
 *   колонкой справа на десктопе (как и в старом `SalesPlanCard`) — один и тот же источник данных,
 *   `direction.salesPerformance`/`direction.isPlanApproved`/`direction.direction`/`period`, только
 *   на направления с `salesPerformance.length > 0` (см. старую `hasSalesPerformance`). Новый макет
 *   добавляет в шапку карточки "Note" вида "Август 2026 · 18 из 31 дня" (`I8BvCO`) — количество
 *   прошедших дней месяца не приходит с бэкенда, считается на фронте от `period`+`new Date()`
 *   (аналогично `getCurrentPeriod` в `features/SalaryReportData`). Категории —
 *   `salesPerformance[]` (одна `Категория · {name}` на элемент, `RK3rl`/`hXb2V`/`gQUYu`): имя,
 *   "осталось {plan.turnover - fact.turnover} ₽", прогресс-трек, подпись "{percentCompletion}% ·
 *   прогноз {forecastPercent}%" — то же вычисление, что в старом `SalesPlanCard`'s
 *   `SalesPlanCategoryRow` (в новом макете не видно отдельной строки "Маржа" — UI-фаза решает,
 *   добавлять ли её, как это уже сделал старый компонент сверх мокапа).
 *
 * Мобильный `b63e8p` — та же информация одним вертикальным стеком (герой → блоки направлений →
 * карточки плана), без отдельной правой колонки — тот же приём адаптива, что уже применяет старый
 * `EmployeeReportBody` (`xl:` две колонки / ниже `xl:` один стек).
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
    /** Развёрнута ли строка правила с данным ключом (`${direction}:${ruleId}`, см. комментарий
     * выше) — общий `Set`-стейт живёт в `model/useSalaryReportPage.ts`
     * (`useSalaryReportSelection`), этот компонент только читает/переключает его. */
    isRuleExpanded: (key: string) => boolean
    onToggleRule: (key: string) => void
    /** Развёрнут ли блок направления (`fNwhK`/`TMa9C`) — по умолчанию оба блока развёрнуты
     * (`Set`-стейт в `useSalaryReportSelection` хранит СВЁРНУТЫЕ направления, см. её комментарий),
     * сворачивание доступно по клику на заголовок блока (`LedgerDirectionBlock`). */
    isDirectionExpanded: (direction: SalaryDirection) => boolean
    onToggleDirection: (direction: SalaryDirection) => void
    className?: string
}
