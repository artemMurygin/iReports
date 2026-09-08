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
          };
};

export type ProductSoldSalaryRule = {
    type: 'ProductSold';
    name: string;
    targetRole: TargetRole;
    config: ProductSoldSalaryConfig;
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
export type TaskCompletionShopSalaryConfig = {
    taskIdByPeriod: Record<string, string>;
    taskTitleTemplate: string;
    taskDescriptionTemplate?: string;
    isRecurring: boolean;
    deadlineTemplate: string;
    // Сумма начисления по умолчанию — зеркало
    // domain/types/salary-rule.types.ts направления service.
    defaultAmount: number;
};

export type TaskCompletionShopSalaryRule = {
    type: 'TaskCompletion';
    name: string;
    targetRole: TargetRole;
    config: TaskCompletionShopSalaryConfig;
};

export type ShopSalaryRuleConfig =
    | PayPerHourShopSalaryConfig
    | ProductSoldSalaryConfig
    | UsedProductSoldSalaryConfig
    | TaskCompletionShopSalaryConfig;

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
    calculate(
        context: ShopCalculationContext,
    ): CalculationLine | null | Promise<CalculationLine | null>;
};
