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
};

export type TaskCompletionSalaryRule = {
    type: 'TaskCompletion';
    name: string;
    targetRole: TargetRole;
    config: TaskCompletionSalaryConfig;
};

export type SalaryRuleConfig =
    | PayPerHourSalaryConfig
    | ServiceCompletedSalaryConfig
    | OrderPayedSalaryConfig
    | TaskCompletionSalaryConfig;

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
    // Отсутствовало до Фазы 6 — нужно ленивому кэшу расчёта (см.
    // domain/services/accounting-cache-freshness.ts), чтобы отличать версию
    // мотивационной схемы по факту правки правила, а не только самой схемы:
    // Entity (базовый класс всех конкретных правил) уже несёт updatedAt
    // рантайм-полем, здесь лишь делаем его частью структурного типа.
    readonly updatedAt: Date;
    // CalculationLine | null (а не всегда CalculationLine) — начиная с
    // TaskCompletion (см. tasks.md раздел 3), правило может не иметь строки
    // расчёта вовсе, а не строку с нулевой суммой: null означает «правило
    // ещё не готово к начислению за этот проход» (например, связанная
    // задача ещё не переведена в статус «Закрыта успешно» — spec:
    // service/accounting#requirement-правило-за-выполнение-задачи-не-видно-в-прогнозе-до-выполнения).
    // Существующие типы правил (PayPerHour/ServiceCompleted/OrderPayed)
    // продолжают всегда возвращать не-null CalculationLine.
    calculate(
        context: CalculationContext,
    ): CalculationLine | null | Promise<CalculationLine | null>;
};
