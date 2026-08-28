import { randomUUID } from 'crypto';
import { AggregateRoot } from '@/shared/domain/aggregate-root.base';
import { AggregateID } from '@/shared/domain/entity.base';

export type ShopErpCashConfigProps = {
    // Cashflow-статья расходов (expenseItem) МойСклада — обязательное поле
    // для cashout (см. WHY у erpCashConfigSchema в contracts/commands/erp-cash.ts).
    moySkladExpenseItemId: string | null;
    // Задел на будущее, не используется адаптером — у CashIn МойСклада нет
    // аналога статьи расходов (см. тот же WHY).
    moySkladIncomeItemId: string | null;
    // Юрлицо (organization) — обязательное поле и у cashout, и у cashin.
    organizationId: string | null;
};

export type CreateShopErpCashConfigProps = Partial<ShopErpCashConfigProps>;

// Конфигурация кассы МойСклада направления shop (PRD 3
// docs/payroll-closing-and-accrual/prd-salary-payout-and-erp-cash-documents.md,
// Фаза 11) — до Фазы 4 docs/service-shop-boundary-violations-fix переиспользовала
// один direction-агностичный класс ErpCashConfig, физически определённый в
// domains/service (см. WHY, который был там). С Фазы 4 — собственный,
// независимый класс shop: не бизнес-логика ни для какой третьей стороны,
// поэтому несёт только поля, которые реально нужны МойСкладу, без
// service-специфичных roappCashboxId/roappCategoryId. Значения приходят из
// файлового конфига модуля на основе env-переменных
// (config/erp-cash.config.ts, shopErpCashConfig) — ShopErpCashConfigProvider
// (infrastructure/config/) строит эту сущность на лету при каждом
// findByDirection(), она не персистентная запись БД и не редактируется
// через API.
export class ShopErpCashConfig extends AggregateRoot<ShopErpCashConfigProps> {
    declare protected readonly _id: AggregateID;

    static create(create: CreateShopErpCashConfigProps): ShopErpCashConfig {
        return new ShopErpCashConfig({
            id: randomUUID(),
            props: {
                moySkladExpenseItemId: create.moySkladExpenseItemId ?? null,
                moySkladIncomeItemId: create.moySkladIncomeItemId ?? null,
                organizationId: create.organizationId ?? null,
            },
        });
    }

    get moySkladExpenseItemId(): string | null {
        return this.props.moySkladExpenseItemId;
    }

    get moySkladIncomeItemId(): string | null {
        return this.props.moySkladIncomeItemId;
    }

    get organizationId(): string | null {
        return this.props.organizationId;
    }

    validate(): void {
        // Комбинация полей не имеет нарушаемого инварианта (все три
        // строковых, может быть заполнено любое подмножество) — проверку
        // «заполнено ли то, что нужно ИМЕННО для этой операции» перед
        // обращением в ERP делает MoyskladCashDocumentAdapter, не эта
        // сущность (см. ShopErpCashConfigIncompleteException).
    }
}
