import { CreateEntityProps } from '@/shared/domain/entity.base';
import { CalculationContext } from '@/shared/domain/calculation-context';
import { CalculationLine } from '@/shared/domain/calculation-line';
import type {
    PercentBorder,
    SalaryBasis,
    SalaryRuleRequest,
    TargetRole,
} from 'ireports-contracts';

export type { TargetRole, SalaryBasis, PercentBorder };

// hours больше не часть config (Фаза 7) — источник часов сотрудника за
// период это сумма часов рабочих смен графика (WorkScheduleEntry.status =
// WORKING, Фаза 5, docs/employee-work-schedule), приходящая в
// CalculationContext.erpData, а не хардкод в правиле.
export type PayPerHourSalaryConfig = {
    price: number;
};

export type PayPerHourSalaryRule = {
    type: 'PayPerHour';
    name: string;
    targetRole: TargetRole;
    config: PayPerHourSalaryConfig;
    // Soft-деактивация правила — см. isActive у SalaryRule ниже.
    isActive: boolean;
};

export type ServiceCompletedSalaryConfig = {
    award:
        | { type: 'Fixed'; price: number }
        | { type: 'ServiceFixed' }
        | { type: 'ServicePercent'; percent: number };
    // Фильтр по категории заказа (Фаза 3, docs/service-plan-salary-rule-order-category-filter) —
    // "категория заказа" здесь это RoappOrderType (RoappOrder.orderTypeId),
    // НЕ SalesPlan.category и не RoappServiceCategory/RoappProductCategory.
    // Пусто/не указано — правило учитывает заказы всех типов (поведение по
    // умолчанию для уже существующих правил без этого поля).
    orderTypeIds?: number[];
};

export type ServiceCompletedSalaryRule = {
    type: 'ServiceCompleted';
    name: string;
    targetRole: TargetRole;
    config: ServiceCompletedSalaryConfig;
    // Soft-деактивация правила — см. isActive у SalaryRule ниже.
    isActive: boolean;
};

// За оплаченный заказ (Фаза 8) — расчёт опирается на исходные суммы заказа
// (RoappOrder.payed/cost/engineerSalary), а не на legacy-KPI
// RoappOrder.managerSalary (см. domain/services/service-calculation-data.repository.ts
// и docs/payroll/prd-payroll-calculation.md, "Технические ограничения").
export type OrderPayedSalaryConfig = {
    award:
        | { type: 'Fixed'; price: number }
        | {
              type: 'FixedPercent';
              percent: number;
              salaryBasis: SalaryBasis;
          }
        | {
              type: 'FloatPercent';
              basePercent: number;
              salaryBasis: SalaryBasis;
              percentBorders: [PercentBorder, PercentBorder, PercentBorder];
          };
    // Фильтр по категории заказа (Фаза 3, docs/service-plan-salary-rule-order-category-filter) —
    // "категория заказа" здесь это RoappOrderType (RoappOrder.orderTypeId),
    // НЕ SalesPlan.category и не RoappServiceCategory/RoappProductCategory.
    // Пусто/не указано — правило учитывает заказы всех типов (поведение по
    // умолчанию для уже существующих правил без этого поля).
    orderTypeIds?: number[];
};

export type OrderPayedSalaryRule = {
    type: 'OrderPayed';
    name: string;
    targetRole: TargetRole;
    config: OrderPayedSalaryConfig;
    // Soft-деактивация правила — см. isActive у SalaryRule ниже.
    isActive: boolean;
};

// За выполнение задачи модуля src/modules/tasks (replace-bitrix-task-integration,
// design.md решение 2/4). taskIdByPeriod — карта «расчётный период → id уже
// существующей задачи», единственное место, где хранится связь «правило ↔
// задача» (tasks о правилах не знает вообще); заполняется точечно —
// CreateSalaryRuleHandler сохраняет туда taskId текущего периода из тела
// запроса (config.taskId, только вход, не персистируется как отдельное
// поле), EnsureRuleTaskForPeriodService дописывает туда новые периоды при
// авто-пересоздании регулярного правила. Правило без записи за период —
// эквивалент прежнего «задача не заведена». taskTitleTemplate/
// taskDescriptionTemplate/deadlineTemplate используются ТОЛЬКО для
// авто-пересоздания задачи регулярного правила на новый период — не для
// самой первой задачи (та создаётся вручную на шаге 1 мастера с
// произвольными заголовком/описанием, см. design.md решение 4).
export type TaskCompletionSalaryConfig = {
    taskIdByPeriod: Record<string, string>;
    taskTitleTemplate: string;
    taskDescriptionTemplate?: string;
    isRecurring: boolean;
    deadlineTemplate: string;
    // Сумма начисления по умолчанию — TaskCompletion.calculate() подставляет
    // её в CalculationLine.amount, когда задача переходит в «Закрыта
    // успешно»; руководитель может изменить сумму при проведении начисления
    // (см. SetTaskCompletionLineRewardHandler), но comment остаётся
    // обязательным.
    defaultAmount: number;
    // Ссылки, прикрепляемые EnsureRuleTaskForPeriodService к каждой
    // АВТОСОЗДАННОЙ задаче регулярного правила (не к самой первой — та
    // заводится вручную, со своими произвольными ссылками, через POST
    // /v1/tasks/:id/links). add-task-rule-task-lifecycle.
    taskLinkTemplates: { url: string; label?: string }[];
};

export type TaskCompletionSalaryRule = {
    type: 'TaskCompletion';
    name: string;
    targetRole: TargetRole;
    config: TaskCompletionSalaryConfig;
    // Soft-деактивация правила — см. isActive у SalaryRule ниже.
    isActive: boolean;
};

// ================= Уровень отдела/направления (add-department-head-salary-rules) ================= //
//
// Implements FR1-FR4 of add-department-head-salary-rules.
//
// Три новых вида правила, не итерирующих транзакции (design.md Decision 2) — всегда считаются
// целиком на того единственного сотрудника, кому назначена схема (targetType = 'Employee'). Формы
// config зеркалят contracts/commands/salary-rule.ts (departmentPercentSalaryConfigSchema и т.п.), как
// и остальные 4 вида выше — домен не импортирует z.infer контракта напрямую.
//
// category: string | null — тот же scope-параметр, что и у существующего ProductSoldEntity (shop):
// null = без фильтра, «весь склад/направление». department, с которым резолвится SalesPerformance
// для DepartmentPercent/DepartmentPlanBonus, по умолчанию берётся из собственного
// BitrixEmployee.departmentId сотрудника, которому назначено правило (design.md Decision 1,
// findEmployeeDepartmentId). departmentId в config ниже — временный костыль поверх этого решения:
// явное переопределение отдела, чей план продаж используется, на случай, когда у собственного
// отдела сотрудника ещё нет плана (см. resolveDepartmentPerformanceOverrides в
// build-service-calculation-context.service.ts) — null сохраняет исходное поведение.

// DepartmentPercent (FR2) — % от факта выручки/маржи отдела/категории, без коэффициента:
// amount = round(fact.(turnover|margin) * percent / 100).
export type DepartmentPercentSalaryConfig = {
    salaryBasis: SalaryBasis;
    category: string | null;
    percent: number;
    // Опционально (как и в contracts) — undefined трактуется наравне с null (см. resolveEntry() у
    // DepartmentPercentEntity).
    departmentId?: number | null;
};

export type DepartmentPercentSalaryRule = {
    type: 'DepartmentPercent';
    name: string;
    targetRole: TargetRole;
    config: DepartmentPercentSalaryConfig;
    // Soft-деактивация правила — см. isActive у SalaryRule ниже.
    isActive: boolean;
};

// DepartmentPlanBonus (FR3) — фиксированная сумма × плавающий коэффициент выполнения плана продаж
// по выручке/марже, переиспользует уже существующий percentBorders/resolveFloatPercentMultiplier и
// уже существующий SalesPerformance.percentCompletion:
// amount = round(fixedAmount * resolveFloatPercentMultiplier(percentBorders, percentCompletion)).
export type DepartmentPlanBonusSalaryConfig = {
    salaryBasis: SalaryBasis;
    category: string | null;
    fixedAmount: number;
    percentBorders: [PercentBorder, PercentBorder, PercentBorder];
    // Опционально (как и в contracts) — undefined трактуется наравне с null (см. resolveEntry() у
    // DepartmentPlanBonusEntity).
    departmentId?: number | null;
};

export type DepartmentPlanBonusSalaryRule = {
    type: 'DepartmentPlanBonus';
    name: string;
    targetRole: TargetRole;
    config: DepartmentPlanBonusSalaryConfig;
    // Soft-деактивация правила — см. isActive у SalaryRule ниже.
    isActive: boolean;
};

// DepartmentTurnoverBonus (FR4) — фиксированная сумма × плавающий коэффициент выполнения плана по
// коэффициенту оборачиваемости конкретного склада (warehouseId — обязательное поле, RoApp warehouse
// id, оборачиваемость скоуплена по категории × складу, не по отделу — design.md Decision 1/2) и
// опционально category внутри него (null — итог по всему складу, см. GoodsTurnoverWarehouseTotal,
// FR5). planTurnoverRatio хранится прямо в конфигурации правила, а не отдельной сущностью плана:
// amount = round(fixedAmount * resolveFloatPercentMultiplier(percentBorders,
//   resolveTurnoverPercentCompletion(factTurnoverRatio, planTurnoverRatio))).
export type DepartmentTurnoverBonusSalaryConfig = {
    warehouseId: number;
    category: string | null;
    fixedAmount: number;
    planTurnoverRatio: number;
    percentBorders: [PercentBorder, PercentBorder, PercentBorder];
};

export type DepartmentTurnoverBonusSalaryRule = {
    type: 'DepartmentTurnoverBonus';
    name: string;
    targetRole: TargetRole;
    config: DepartmentTurnoverBonusSalaryConfig;
    // Soft-деактивация правила — см. isActive у SalaryRule ниже.
    isActive: boolean;
};

export type SalaryRuleConfig =
    | PayPerHourSalaryConfig
    | ServiceCompletedSalaryConfig
    | OrderPayedSalaryConfig
    | TaskCompletionSalaryConfig
    | DepartmentPercentSalaryConfig
    | DepartmentPlanBonusSalaryConfig
    | DepartmentTurnoverBonusSalaryConfig;

// Форма запроса на создание правила — контракт (SalaryRuleRequest), а не
// подмножество из двух реализованных типов: контракт уже включает
// OrderPayed (сущность которого — заглушка до Фазы 8), и
// дублировать здесь список вручную значит расходиться с ним при каждом
// добавлении нового типа правила (см. docs/CLAUDE.md — контракты как
// единственный источник истины по форме данных). Незарегистрированный тип
// по-прежнему отклоняется в рантайме — SalaryRuleFactory.create() бросает
// NotFoundException, если типа нет в salaryRuleRegistry.
export type CreateSalaryRuleProps = SalaryRuleRequest;

export type SalaryRuleTypes = CreateSalaryRuleProps['type'];

export type SalaryRuleClass = {
    // CreateEntityProps<any>, а не <CreateSalaryRuleProps> — у каждого
    // конкретного класса (PayPerHoursEntity, ServiceCompletedEntity) свой
    // более узкий internal-props-тип (с литералом type: 'PayPerHour' и
    // т.п.), и при строгой проверке конструкторной сигнатуры это не даёт
    // положить класс в Map<SalaryRuleTypes, SalaryRuleClass> — конструктор
    // проверяется контравариантно, в отличие от обычных методов.
    new (props: CreateEntityProps<any>): SalaryRule;
    create(rule: CreateSalaryRuleProps): SalaryRule;
};

export type SalaryRule = {
    readonly id: string;
    readonly name: string;
    readonly type: string;
    readonly targetRole: TargetRole;
    readonly config: SalaryRuleConfig;
    // Soft-деактивация зарплатного правила: деактивированное правило
    // перестаёт участвовать в расчётах (mergeEmployeeSalaryRules,
    // src/shared/domain/employee-salary-rules.ts) и пропадает из ответа GET
    // .../motivation-schema/:id (MotivationSchemaMapper.toDetailResponse),
    // но не удаляется физически — история его начислений сохраняется.
    readonly isActive: boolean;
    // Отсутствовало до Фазы 6 — нужно ленивому кэшу расчёта (см.
    // domain/services/accounting-cache-freshness.ts), чтобы отличать версию
    // мотивационной схемы по факту правки правила, а не только самой схемы:
    // Entity (базовый класс всех конкретных правил) уже несёт updatedAt
    // рантайм-полем, здесь лишь делаем его частью структурного типа.
    readonly updatedAt: Date;
    // CalculationLine | null (а не всегда CalculationLine) — начиная с
    // TaskCompletion (см. tasks.md раздел 3), правило может не иметь строки
    // расчёта вовсе, а не строку с нулевой суммой: null означает «у правила
    // ещё нет связанной задачи за этот период» (config.taskIdByPeriod без
    // записи на текущий период) — spec:
    // service/accounting#requirement-строка-правила-за-выполнение-задачи-появляется-сразу-и-растёт-по-статусу-задачи
    // (task-completion-progressive-visibility). Как только задача заведена,
    // TaskCompletion.calculate() возвращает не-null строку в ОБОИХ проходах,
    // а amount — 0 или config.defaultAmount по статусу задачи и режиму
    // (FACT/PROGNOSE). Существующие типы правил (PayPerHour/ServiceCompleted/
    // OrderPayed) продолжают всегда возвращать не-null CalculationLine.
    calculate(
        context: CalculationContext,
    ): CalculationLine | null | Promise<CalculationLine | null>;
    // Soft-деактивация/реактивация (DeactivateSalaryRuleHandler/
    // ReactivateSalaryRuleHandler) — прямая мутация isActive, тот же приём,
    // что и MotivationSchema.rename().
    deactivate(): void;
    activate(): void;
};
