import { CreateEntityProps } from '@/shared/domain/entity.base';
import { CalculationContext } from '@/shared/domain/calculation-context';
import { CalculationLine } from '@/shared/domain/calculation-line';
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

// Источник часов — тот же EmployeeHoursEntry, что и у сервиса (общая
// Prisma-таблица `employee_hours_entries`, без direction — ручной ввод
// часов сотрудника за период направление-агностичен, час работы не
// принадлежит ERP). Приходит в CalculationContext.erpData.hoursWorked, а
// не хардкодится в config.
export type PayPerHourShopSalaryConfig = {
    price: number;
    bonus?: number;
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
// shop-calculation-data.types.ts).
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
    bonus?: number;
};

export type ProductSoldSalaryRule = {
    type: 'ProductSold';
    name: string;
    targetRole: TargetRole;
    config: ProductSoldSalaryConfig;
};

export type ShopSalaryRuleConfig =
    | PayPerHourShopSalaryConfig
    | ProductSoldSalaryConfig;

// Форма запроса на создание правила — контракт (ShopSalaryRuleRequest), а
// не подмножество реализованных типов (то же решение, что у сервиса — см.
// domains/service/modules/accounting/domain/types/salary-rule.types.ts):
// расширение contracts/commands/shop-salary-rule.ts в Фазе 13
// (UsedProductSold/TaskCompleted) не потребует правки этого файла заново.
export type CreateShopSalaryRuleProps = ShopSalaryRuleRequest;

export type ShopSalaryRuleTypes = CreateShopSalaryRuleProps['type'];

export type ShopSalaryRuleClass = {
    new (props: CreateEntityProps<any>): ShopSalaryRule;
    create(rule: CreateShopSalaryRuleProps): ShopSalaryRule;
};

export type ShopSalaryRule = {
    readonly id: string;
    readonly name: string;
    readonly type: string;
    readonly targetRole: TargetRole;
    readonly config: ShopSalaryRuleConfig;
    readonly updatedAt: Date;
    calculate(
        context: CalculationContext,
    ): CalculationLine | Promise<CalculationLine>;
};
