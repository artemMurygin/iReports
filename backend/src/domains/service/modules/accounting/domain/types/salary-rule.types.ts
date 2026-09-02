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
};

// За выполненную задачу (change salary-rule-bitrix-task) — "задача" здесь
// реальная задача Bitrix24, привязанная к правилу; постановка, обсуждение и
// приёмка идут в Bitrix24, а iReports читает статус и расчётный месяц задачи
// пакетным запросом при расчёте (см. task-completed.entity.ts,
// design.md Decision 1). Единственный вид вознаграждения — фиксированная
// сумма (Decision 2; BREAKING — вариант award/FloatPercent, использовавшийся
// прежним временным воркфлоу TaskCompletion, удалён вместе с ним).
// Фактическая сумма к выплате по закрытой задаче за конкретный расчётный
// период — ручной ввод руководителя (spec.md, "Ручной ввод фактической
// суммы по закрытой задаче"), хранится в props правила, без отдельной
// Prisma-модели (Decision 2).
export type TaskCompletedActualAmountEntry = {
    period: string;
    amount: number;
};

export type TaskCompletedSalaryConfig = {
    description: string;
    // Расчётный месяц правила на момент создания/редактирования — границы,
    // в которых обязан лежать dueDate (Decision 9). НЕ текущий расчётный
    // месяц, который правило обслуживает в моменте расчёта — тот
    // определяется живым тегом периода задачи Bitrix24 (Decision 1 и 7).
    period: string;
    isRecurring: boolean;
    // 'YYYY-MM-DD', см. contracts/commands/salary-rule.ts —
    // taskCompletedDueDateSchema.
    dueDate: string;
    // Сумма вознаграждения за полное выполнение — единственный вид награды
    // (Decision 2). Оборачивается value object'ом TaskRewardAmount на
    // доменном уровне (см. task-completed.entity.ts), сырое число — только
    // форма хранения в props: Json.
    rewardAmount: number;
    // ID задач Bitrix24, накопленные за всё время правила: один элемент
    // для разового правила, по одному новому элементу на каждый
    // регенерированный месяц для регулярного (design.md change
    // salary-rule-bitrix-task, Decision 1). Расчётный месяц задачи не
    // дублируется здесь — при расчёте он читается из Bitrix24 (тег
    // периода) пакетным запросом по этим ID.
    bitrixTaskIds?: number[];
    // По одной записи на период, где руководитель вводил фактическую
    // сумму (Decision 2 выше) — upsert по period, см.
    // TaskCompletedEntity.upsertActualAmount.
    actualAmounts?: TaskCompletedActualAmountEntry[];
};

export type TaskCompletedSalaryRule = {
    type: 'TaskCompleted';
    name: string;
    targetRole: TargetRole;
    config: TaskCompletedSalaryConfig;
};

export type SalaryRuleConfig =
    | PayPerHourSalaryConfig
    | ServiceCompletedSalaryConfig
    | OrderPayedSalaryConfig
    | TaskCompletedSalaryConfig;

// Форма запроса на создание правила — контракт (SalaryRuleRequest), а не
// подмножество из двух реализованных типов: контракт уже включает
// OrderPayed/TaskCompleted (сущности которых — заглушки до Фаз 7-8), и
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
    // Отсутствовало до Фазы 6 — нужно ленивому кэшу расчёта (см.
    // domain/services/accounting-cache-freshness.ts), чтобы отличать версию
    // мотивационной схемы по факту правки правила, а не только самой схемы:
    // Entity (базовый класс всех конкретных правил) уже несёт updatedAt
    // рантайм-полем, здесь лишь делаем его частью структурного типа.
    readonly updatedAt: Date;
    calculate(
        context: CalculationContext,
    ): CalculationLine | Promise<CalculationLine>;
};
