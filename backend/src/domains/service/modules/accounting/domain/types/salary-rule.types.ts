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
// период это EmployeeHoursEntry (ручной ввод), приходящий в
// CalculationContext.erpData, а не хардкод в правиле. bonus — необязательный
// индивидуальный бонус, общий для всех типов правил (см. contracts,
// individualBonusFieldSchema).
export type PayPerHourSalaryConfig = {
    price: number;
    bonus?: number;
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
    bonus?: number;
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
    bonus?: number;
};

export type OrderPayedSalaryRule = {
    type: 'OrderPayed';
    name: string;
    targetRole: TargetRole;
    config: OrderPayedSalaryConfig;
};

// За выполненную задачу (Фаза 8) — "задача" в этой итерации это внутренний
// ручной ввод (TaskCompletionEntity), не интеграция с Bitrix24 Tasks (см.
// domain/entities/task-completion.entity.ts). FloatPercent для задач не
// описан в PRD подробно — решение по этому открытому вопросу: тот же
// трёхпороговый механизм percentBorders, что и у OrderPayed, но база —
// фиксированная ставка за подтверждённую задачу (basePrice), а не сумма
// заказа (см. contracts/commands/salary-rule.ts).
export type TaskCompletedSalaryConfig = {
    award:
        | { type: 'Fixed'; price: number }
        | {
              type: 'FloatPercent';
              basePrice: number;
              percentBorders: [PercentBorder, PercentBorder, PercentBorder];
          };
    bonus?: number;
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
