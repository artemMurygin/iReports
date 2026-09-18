import { CreateEntityProps } from '@/shared/domain/entity.base';
import { CalculationLine } from '@/shared/domain/calculation-line';
import type { ShopCalculationContext } from './calculation-context.types';
import type {
    PercentBorder,
    ShopSalaryBasis,
    ShopSalaryRuleRequest,
    TargetRole,
} from 'ireports-contracts';

export type { TargetRole, ShopSalaryBasis, PercentBorder };

// Зеркало domains/service/modules/accounting/domain/types/salary-rule.types.ts
// (Фаза 12, issue #57) — независимый набор типов правил магазина, без
// переиспользования кода сервиса. Формы конфигов повторяют
// contracts/commands/shop-salary-rule.ts.

// ========================== Почасовая ставка ========================== //

// Источник часов — сумма часов рабочих смен графика (WorkScheduleEntry,
// Фаза 5, docs/employee-work-schedule; общая Prisma-таблица
// `work_schedule_entries`, без direction — час работы направление-
// агностичен), тот же источник, что и у сервиса. Приходит в
// CalculationContext.erpData.hoursWorked, а не хардкодится в config.
export type PayPerHourShopSalaryConfig = {
    price: number;
};

export type PayPerHourShopSalaryRule = {
    type: 'PayPerHour';
    name: string;
    targetRole: TargetRole;
    config: PayPerHourShopSalaryConfig;
    isActive: boolean;
};

// ========================== За проданный товар ========================== //

// category — id корневой папки MoySkladProductFolder; null = все товары
// (issue #60). Раскрытие до потомков — забота application-слоя (при
// сборке CalculationContext, через ProductFolderTreeService,
// domains/shop/sync/moySklad/product-folder-tree.service.ts), а не самого
// правила: calculate() — чистая функция без IO (см. backend/CLAUDE.md,
// domain не имеет доступа к БД), поэтому результат раскрытия дерева
// приходит уже готовым в erpData.categoryDescendantFolderIds (см.
// calculation-data.types.ts).
export type ProductSoldSalaryConfig = {
    category: string | null;
    award:
        | { type: 'Fixed'; price: number }
        | {
              type: 'FixedPercent';
              percent: number;
              salaryBasis: ShopSalaryBasis;
          }
        | {
              type: 'FloatPercent';
              basePercent: number;
              salaryBasis: ShopSalaryBasis;
              percentBorders: [PercentBorder, PercentBorder, PercentBorder];
          }
        // "Продажа товара Б/У" — вариант награды ProductSold (не отдельный тип правила, не путать
        // с UsedProductSoldSalaryConfig ниже — тот про закупщиков). Формула FloatPercent с порогом
        // по марже КОНКРЕТНОЙ позиции: profit >= marginThreshold считается по FloatPercent
        // (basePercent × множитель плана), но не ниже floorAmount; profit < marginThreshold —
        // lowMarginPercent от sum (REVENUE) позиции вместо базовой формулы. См.
        // product-sold.entity.ts — расчёт per-item, а не агрегированно по всем позициям правила.
        | {
              type: 'FloatPercentMarginFloor';
              basePercent: number;
              salaryBasis: ShopSalaryBasis;
              percentBorders: [PercentBorder, PercentBorder, PercentBorder];
              marginThreshold: number;
              floorAmount: number;
              lowMarginPercent: number;
          };
};

export type ProductSoldSalaryRule = {
    type: 'ProductSold';
    name: string;
    targetRole: TargetRole;
    config: ProductSoldSalaryConfig;
    isActive: boolean;
};

// ========================== Вознаграждение закупщику БУ техники ========================== //

// Фаза 13 (issue #62/#63) — зеркало ProductSoldSalaryConfig по структуре
// (category/award), но award — только Fixed/FixedPercent (без
// FloatPercent: закупщик не привязан к выполнению плана продаж, см.
// contracts/commands/shop-salary-rule.ts).
export type UsedProductSoldSalaryConfig = {
    category: string | null;
    award:
        | { type: 'Fixed'; price: number }
        | {
              type: 'FixedPercent';
              percent: number;
              salaryBasis: ShopSalaryBasis;
          };
};

export type UsedProductSoldSalaryRule = {
    type: 'UsedProductSold';
    name: string;
    targetRole: TargetRole;
    config: UsedProductSoldSalaryConfig;
    isActive: boolean;
};

// ========================== За выполнение задачи ========================== //

// openspec/changes/replace-bitrix-task-integration, design.md решение 2/4 —
// зеркало TaskCompletionSalaryConfig сервиса (issue #57 — независимая
// копия). Задача больше не создаётся ВМЕСТЕ с правилом (см.
// CreateShopSalaryRuleHandler) — фронт создаёт её отдельным запросом
// (`POST /v1/tasks`) и передаёт уже готовый taskId в теле запроса на
// создание правила (contracts: TaskCompletionShopSalaryConfigRequest),
// который сохраняется как taskIdByPeriod[текущийПериод] — это ЕДИНСТВЕННЫЙ
// момент, где домен-объект строится из wire-формы запроса (см.
// TaskCompletionShop.create()/.restore()).
//
// taskIdByPeriod — карта "период → id задачи" (design.md решение 2:
// «Где теперь живёт связь "правило ↔ задача за период»): разовое правило
// заводит ровно одну запись за всё время жизни, регулярное — по одной на
// период. taskTitleTemplate/taskDescriptionTemplate/deadlineTemplate —
// шаблон ТОЛЬКО для авто-пересоздания задачи регулярного правила на новый
// период (EnsureShopSalaryTaskForPeriodService, design.md решение 4) — не
// для самой первой задачи (та создана руками с произвольными заголовком/
// описанием до появления правила, расхождение с шаблоном — осознанный
// компромисс). deadlineTemplate — ISO-дата, для разового правила берётся
// буквально, для регулярного используется только число месяца.
// split-task-completion-rule-form — зеркало domain/types/salary-rule.types.ts направления service:
// дискриминированный по isRecurring тип, а не плоский объект. Шаблонные поля
// (taskTitleTemplate/taskDescriptionTemplate/deadlineTemplate/deadlinePeriodOffset/
// taskLinkTemplates) существуют только у регулярного правила; у разового задача создаётся один раз
// из буквальных полей запроса (TaskCompletionShopSalaryConfigRequest), которые в домене не
// персистируются.
export type TaskCompletionShopSalaryConfig = {
    taskIdByPeriod: Record<string, string>;
    // Сумма начисления по умолчанию — зеркало
    // domain/types/salary-rule.types.ts направления service. Общее поле для обоих сценариев.
    defaultAmount: number;
    // Период (формат YYYY-MM), к которому относится последняя/текущая
    // задача правила — зеркало domain/types/salary-rule.types.ts направления
    // service (add-task-salary-rule-accounting-period, design.md решение 1).
    // Не опционально здесь: деривация для легаси-строк без этого поля в
    // персистентном `props` происходит один раз на границе
    // ShopSalaryRuleMapper.toDomain (design.md решение 1), дальше в домене и
    // в API-ответе поле всегда присутствует.
    accountingPeriod: string;
} & (
    | { isRecurring: false }
    | {
          isRecurring: true;
          taskTitleTemplate: string;
          taskDescriptionTemplate?: string;
          deadlineTemplate: string;
          // recurring-task-deadline-offset, design.md решение 1/3 — смещение (в
          // расчётных периодах, 0..3) месяца дедлайна регулярной задачи
          // относительно месяца периода задачи. Хранится как обычное число (не
          // как объект DeadlinePeriodOffset VO) — тот же паттерн, что и у
          // ProductSoldSalaryConfig.award.percentBorders: конфиг остаётся plain
          // data, а DeadlinePeriodOffset.create() используется ТРАНЗИТНО только
          // для валидации инварианта диапазона (см. TaskCompletionShop.buildConfig()/
          // validate()).
          deadlinePeriodOffset: number;
          // Ссылки, прикрепляемые EnsureShopSalaryTaskForPeriodService к каждой
          // АВТОСОЗДАННОЙ задаче регулярного правила. add-task-rule-task-lifecycle,
          // зеркало service.
          taskLinkTemplates: { url: string; label?: string }[];
      }
);

export type TaskCompletionShopSalaryRule = {
    type: 'TaskCompletion';
    name: string;
    targetRole: TargetRole;
    config: TaskCompletionShopSalaryConfig;
    isActive: boolean;
};

// ================= Уровень отдела/направления (add-department-head-salary-rules) ================= //
//
// Implements FR1-FR4 of add-department-head-salary-rules.
//
// Зеркало трёх новых видов правила из domains/service/modules/accounting/domain/types/
// salary-rule.types.ts — независимая копия (issue #57 принцип "зеркальные, но независимые" модули
// доменов), состав полей идентичен по смыслу, отличия: ShopSalaryBasis (REVENUE/MARGIN — нет
// SALARY_MINUS_ENGINEER_SALARY, в магазине нет роли инженера) и warehouseId: string (MoySklad UUID)
// вместо number (RoApp warehouse id) у сервиса.

// DepartmentPercent (FR2) — % от факта выручки/маржи категории/магазина, без коэффициента:
// amount = round(fact.(turnover|margin) * percent / 100).
export type DepartmentPercentShopSalaryConfig = {
    salaryBasis: ShopSalaryBasis;
    category: string | null;
    percent: number;
    // Временный костыль поверх design.md Decision 1 (зеркало WHY у одноимённого поля в
    // domains/service/modules/accounting) — явное переопределение отдела, чей план продаж
    // используется, вместо собственного отдела сотрудника. Опционально, как и в contracts —
    // undefined трактуется наравне с null (см. resolveEntry() у DepartmentPercentEntity).
    departmentId?: number | null;
};

export type DepartmentPercentShopSalaryRule = {
    type: 'DepartmentPercent';
    name: string;
    targetRole: TargetRole;
    config: DepartmentPercentShopSalaryConfig;
    isActive: boolean;
};

// DepartmentPlanBonus (FR3) — фиксированная сумма × плавающий коэффициент выполнения плана продаж
// по выручке/марже, переиспользует уже существующий percentBorders/FloatPercentSchedule и уже
// существующий ShopSalesPerformance.percentCompletion.
export type DepartmentPlanBonusShopSalaryConfig = {
    salaryBasis: ShopSalaryBasis;
    category: string | null;
    fixedAmount: number;
    percentBorders: [PercentBorder, PercentBorder, PercentBorder];
    // Временный костыль — см. WHY у DepartmentPercentShopSalaryConfig.departmentId.
    departmentId?: number | null;
};

export type DepartmentPlanBonusShopSalaryRule = {
    type: 'DepartmentPlanBonus';
    name: string;
    targetRole: TargetRole;
    config: DepartmentPlanBonusShopSalaryConfig;
    isActive: boolean;
};

// DepartmentTurnoverBonus (FR4) — фиксированная сумма × плавающий коэффициент выполнения плана по
// коэффициенту оборачиваемости конкретного склада МойСклад (warehouseId — обязательный строковый
// UUID, оборачиваемость скоуплена по категории × складу, не по отделу) и опционально category внутри
// него (null — итог по всему складу). planTurnoverRatio хранится прямо в конфигурации правила.
export type DepartmentTurnoverBonusShopSalaryConfig = {
    warehouseId: string;
    category: string | null;
    fixedAmount: number;
    planTurnoverRatio: number;
    percentBorders: [PercentBorder, PercentBorder, PercentBorder];
};

export type DepartmentTurnoverBonusShopSalaryRule = {
    type: 'DepartmentTurnoverBonus';
    name: string;
    targetRole: TargetRole;
    config: DepartmentTurnoverBonusShopSalaryConfig;
    isActive: boolean;
};

export type ShopSalaryRuleConfig =
    | PayPerHourShopSalaryConfig
    | ProductSoldSalaryConfig
    | UsedProductSoldSalaryConfig
    | TaskCompletionShopSalaryConfig
    | DepartmentPercentShopSalaryConfig
    | DepartmentPlanBonusShopSalaryConfig
    | DepartmentTurnoverBonusShopSalaryConfig;

// Форма запроса на создание правила — контракт (ShopSalaryRuleRequest), а
// не подмножество реализованных типов (то же решение, что у сервиса — см.
// domains/service/modules/accounting/domain/types/salary-rule.types.ts):
// расширение contracts/commands/shop-salary-rule.ts новым типом правила не
// потребует правки этого файла заново.
export type CreateShopSalaryRuleProps = ShopSalaryRuleRequest;

export type ShopSalaryRuleTypes = CreateShopSalaryRuleProps['type'];

export type ShopSalaryRuleClass = {
    new (props: CreateEntityProps<any>): ShopSalaryRule;
    create(rule: CreateShopSalaryRuleProps): ShopSalaryRule;
};

// Раздел 4 (add-task-based-salary-rule) — calculate() может вернуть null:
// TaskCompletionShop (раздел 15) сигнализирует так "строка отсутствует в
// отчёте, пока связанная задача Bitrix24 не выполнена" (spec
// shop/accounting), а не CalculationLine с amount: 0 — ноль неотличим от
// "правило посчитано и заработало 0". Существующие типы правил
// (PayPerHour/ProductSold/UsedProductSold) продолжают всегда возвращать
// не-null CalculationLine.
export type ShopSalaryRule = {
    readonly id: string;
    readonly name: string;
    readonly type: string;
    readonly targetRole: TargetRole;
    readonly config: ShopSalaryRuleConfig;
    readonly updatedAt: Date;
    // Soft-деактивация зарплатного правила (фундамент фичи "soft-деактивация
    // зарплатного правила") — деактивированное правило перестаёт участвовать
    // в расчётах (см. mergeEmployeeSalaryRules,
    // src/shared/domain/employee-salary-rules.ts) и пропадает из UI схемы, но
    // не удаляется физически. Зеркало domains/service.
    readonly isActive: boolean;
    calculate(
        context: ShopCalculationContext,
    ): CalculationLine | null | Promise<CalculationLine | null>;
    // Soft-деактивация/реактивация (DeactivateShopSalaryRuleHandler/
    // ReactivateShopSalaryRuleHandler) — прямая мутация isActive, тот же
    // приём, что и ShopMotivationSchema.rename().
    deactivate(): void;
    activate(): void;
};
