import type {
    DepartmentSalaryReportEmployee,
    EmployeeSalaryReportResponse,
    EmployeeSalaryReportRule,
    FactPrognoseAmount,
    FloatPercentInfo,
    SalesPerformanceSummary,
} from 'ireports-contracts'

/**
 * Направление бизнеса — как и везде в проекте (`features/SalesPlan`'s `SalesDirection`), но
 * заведено заново в этом модуле (а не импортировано оттуда): страница не может импортировать
 * `model` другой фичи/страницы за пределами её публичного `index.ts`, а `SalesDirection` там не
 * реэкспортирован. Тот же приём, что и `RuleType` в `pages/SalaryRuleList/model/types.ts`.
 */
export type SalaryDirection = 'service' | 'shop'

export const SALARY_DIRECTION_LABELS: Record<SalaryDirection, string> = {
    service: 'Сервис',
    shop: 'Магазин',
}

/**
 * Статус документа начисления направления сотрудника за закрытый период — `null` для открытого
 * периода или если сотрудник в снапшот не попал (см. `contracts/commands/salary-rule.ts`,
 * `directionSalaryReportSchema.accrualStatus`).
 */
export type SalaryAccrualStatus = EmployeeSalaryReportResponse['accrualStatus']

/** Правило отчёта сотрудника/отдела — реэкспорт контрактного типа под коротким именем. */
export type SalaryReportRule = EmployeeSalaryReportRule

/** То же правило, но с проставленным направлением — нужно для сведённого отчёта сотрудника
 * (оба направления вперемешку, например для будущего `RulesSideMenu`), где `rules[]` каждого
 * направления сам по себе не говорит, откуда он взят. */
export type SalaryReportRuleWithDirection = SalaryReportRule & { direction: SalaryDirection }

/**
 * Один "развёрнутый" отчёт направления в составе отчёта сотрудника — форма зеркалит
 * `directionSalaryReportSchema` (минус `period`, который общий на оба направления и живёт на
 * уровне `EmployeeReportVM`), плюс готовый `label` для UI ("Сервис"/"Магазин"), чтобы
 * презентационные компоненты не считали его сами.
 */
export type DirectionReportVM = {
    direction: SalaryDirection
    label: string
    isClosed: boolean
    total: FactPrognoseAmount
    rules: SalaryReportRule[]
    salesPerformance: SalesPerformanceSummary | null
    isPlanApproved: boolean
    accrualStatus: SalaryAccrualStatus
}

/**
 * Сведённый отчёт сотрудника — оба направления параллельно (см. `useEmployeeSalaryReport.ts`).
 * `directions` содержит только те направления, где у бэкенда реально нашёлся отчёт (404 —
 * сотрудник не работает в этом направлении — отфильтровывается на уровне хука, а не
 * представляется тут как ошибка/пустая запись); поэтому массив может быть длиной 0/1/2.
 */
export type EmployeeReportVM = {
    period: string
    directions: DirectionReportVM[]
    /** Сумма `total` по всем присутствующим направлениям (`sumAllFactPrognose`). `prognose` —
     * `null`, если хотя бы одно присутствующее направление закрыто (см. `sumFactPrognose`). */
    grandTotal: FactPrognoseAmount
    /** `true`, только если ВСЕ присутствующие направления закрыты (для баннера "Месяц закрыт" на
     * уровне страницы) — смешанное состояние (одно направление закрыто, другое нет) не считается
     * закрытым отчётом целиком; для точного статуса конкретного направления читайте
     * `directions[].isClosed`. Если направлений нет вовсе (оба 404), считается `false` — закрывать
     * нечего. */
    isClosed: boolean
}

/** Один сотрудник в отчёте отдела — реэкспорт контрактного типа. */
export type DepartmentReportEmployeeVM = DepartmentSalaryReportEmployee

/** Отчёт отдела — строго однонаправленный (см. `contracts/commands/salary-rule.ts`,
 * `departmentSalaryReportResponseSchema`), поэтому `direction` тут — не массив, а одно
 * значение, выбранное фильтром страницы. */
export type DepartmentReportVM = {
    period: string
    direction: SalaryDirection
    department: number
    isClosed: boolean
    total: FactPrognoseAmount
    employees: DepartmentReportEmployeeVM[]
}

/**
 * `rule.floatPercent` — только для правил с `award.type === 'FloatPercent'` (см. контракт); у
 * фиксированных правил его нет вовсе, и по правилам семантики отчёта проценты для них не
 * показываются совсем (не "0%", а отсутствие ячейки). Этот хелпер — единственное место, где
 * компонент должен проверять "показывать ли проценты" — вместо разбросанных по UI проверок
 * `rule.floatPercent !== undefined`.
 */
export function isFloatPercentRule(rule: SalaryReportRule): boolean {
    return rule.floatPercent !== undefined
}

/** Пара «факт/прогноз» порогов `FloatPercent`-правила — `null` у правил без плавающего процента
 * (см. `isFloatPercentRule`). Просто типобезопасно разворачивает `rule.floatPercent ?? null`,
 * чтобы вызывающему коду не нужно было повторять эту проверку самому. */
export function getRulePercents(
    rule: SalaryReportRule,
): { fact: FloatPercentInfo; prognose: FloatPercentInfo } | null {
    return rule.floatPercent ?? null
}

/**
 * Складывает две пары «факт/прогноз» — `prognose` результата `null`, если он `null` хотя бы у
 * одного слагаемого (см. PRD: у закрытого периода прогноз не считается вовсе, поэтому его нельзя
 * подменить фактом/нулём и просуммировать как обычное число).
 */
export function sumFactPrognose(a: FactPrognoseAmount, b: FactPrognoseAmount): FactPrognoseAmount {
    return {
        fact: a.fact + b.fact,
        prognose: a.prognose === null || b.prognose === null ? null : a.prognose + b.prognose,
    }
}

/** `sumFactPrognose`, свёрнутый по всему массиву; пустой массив -> `{ fact: 0, prognose: 0 }`. */
export function sumAllFactPrognose(amounts: FactPrognoseAmount[]): FactPrognoseAmount {
    return amounts.reduce(sumFactPrognose, { fact: 0, prognose: 0 })
}
