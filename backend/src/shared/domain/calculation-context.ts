// Контекст расчёта зарплаты — единый для доменов service и shop примитив,
// собираемый один раз оркестратором расчёта периода (см.
// domains/service/modules/accounting/domain/services/period-calculation.orchestrator.ts)
// и передаваемый неизменным во все правила мотивационной схемы сотрудника.
// Правило не обращается к репозиториям и не ходит в БД само — всё
// необходимое приходит из контекста. Это технический примитив без бизнес-
// логики, поэтому его место здесь, а не в конкретном доменном модуле — см.
// docs/payroll/prd-payroll-calculation.md, раздел «Контекст расчёта».
//
// В контекст намеренно НЕ входят:
// - роль — она лежит в самом правиле (targetRole), правило само решает, где
//   искать сотрудника в данных;
// - результаты других правил схемы — в этой итерации правила независимы, их
//   результаты просто складываются.
export type AccountingDirection = 'service' | 'shop';

export type AccountingPeriodStatus = 'OPEN' | 'CLOSED';

// FACT — правило считает по текущему проценту выполнения плана, PROGNOSE —
// по прогнозному. Личная база сотрудника (его заказы/часы/продажи) в обоих
// режимах одна и та же, различается только множитель — см. PRD, раздел 6.
export type SalaryCalculationMode = 'FACT' | 'PROGNOSE';

// Ссылка на идентификацию сотрудника во внешней системе. Полноценная
// сущность EmployeeIdentity появляется в Фазе 2 (CRUD, гард администратора
// портала) — здесь фиксируется только форма, которую обязан уметь нести
// контекст уже сейчас.
export type ExternalSystem = 'ROAPP' | 'MOY_SKLAD';
// MOY_SKLAD_ONLINE_PURCHASER_FIELD / MOY_SKLAD_OFFLINE_PURCHASER_FIELD —
// закупщики БУ техники магазина (Фаза 10) — тот же строковый механизм, что
// ONLINE_MANAGER_FIELD у RemOnline (см. EmployeeIdentityType в
// employee-identity.prisma).
export type ExternalIdentifierType =
    | 'EMPLOYEE_ID'
    | 'ONLINE_MANAGER_FIELD'
    | 'MOY_SKLAD_ONLINE_PURCHASER_FIELD'
    | 'MOY_SKLAD_OFFLINE_PURCHASER_FIELD';

export interface EmployeeIdentityRef {
    system: ExternalSystem;
    identifierType: ExternalIdentifierType;
    externalId: string;
}

export interface CalculationEmployee {
    // BitrixEmployee.id — Bitrix-сотрудник является единственным источником
    // истины о человеке, все расчёты адресуют сотрудника через него.
    id: number;
    identities: EmployeeIdentityRef[];
}

export interface CalculationPeriod {
    direction: AccountingDirection;
    // 'YYYY-MM'
    period: string;
    from: Date;
    to: Date;
    status: AccountingPeriodStatus;
}

// Минимальный срез выполнения плана, нужный процентным правилам
// (FloatPercent и т.п.). Полная форма SalesPerformance появляется в Фазе 5
// вместе с модулем sales — здесь заранее зафиксировано только то, от чего
// уже сейчас зависит сигнатура calculate().
export interface SalesPerformanceContext {
    department: number;
    category: string | null;
    percentCompletion: number;
}

export interface CalculationContext<TErpData = unknown> {
    employee: CalculationEmployee;
    period: CalculationPeriod;
    mode: SalaryCalculationMode;
    // Данные ERP за период — уже загруженные оркестратором, а не
    // запрашиваемые правилом самостоятельно. Конкретная форма — на
    // усмотрение домена (для service — заказы/позиции RoApp, для shop —
    // отгрузки/позиции МойСклада).
    erpData: TErpData;
    // null, пока для периода нет плана продаж (в частности — до Фазы 5,
    // когда сам модуль sales ещё не существует) либо правило не привязано
    // к категории/отделу с планом.
    salesPerformance: SalesPerformanceContext | null;
}
