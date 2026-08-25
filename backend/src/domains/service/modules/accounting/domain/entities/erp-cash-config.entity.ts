import { randomUUID } from 'crypto';
import { AggregateRoot } from '@/shared/domain/aggregate-root.base';
import { AggregateID } from '@/shared/domain/entity.base';
import type { AccountingDirection } from '@/shared/domain/calculation-context';
import { ArgumentInvalidException } from '@/shared/exceptions';

export type ErpCashConfigProps = {
    direction: AccountingDirection;
    roappCashboxId: number | null;
    // Cashflow Category ID — RemOnline отклоняет POST .../transactions без
    // category_id (400), хотя схема эндпоинта формально не помечает поле
    // обязательным (см. WHY у resolveConfig() в roapp-cash-document.adapter.ts).
    roappCategoryId: number | null;
    moySkladExpenseItemId: string | null;
    moySkladIncomeItemId: string | null;
    organizationId: string | null;
};

export type CreateErpCashConfigProps = {
    direction: AccountingDirection;
} & Partial<
    Pick<
        ErpCashConfigProps,
        | 'roappCashboxId'
        | 'roappCategoryId'
        | 'moySkladExpenseItemId'
        | 'moySkladIncomeItemId'
        | 'organizationId'
    >
>;

// Конфигурация кассы направления (PRD 3
// docs/payroll-closing-and-accrual/prd-salary-payout-and-erp-cash-documents.md:
// «Выбора кассы у пользователя нет») — читается адаптером ErpCashDocumentPort
// перед обращением в ERP; пустая конфигурация — отказ до обращения в ERP
// (см. «Критерии готовности» PRD 3). Значения приходят из файлового конфига
// модуля на основе env-переменных (правка пользователя от 2026-08-24, см.
// заметку в конце Фазы 11 плана) — ErpCashConfigProvider (infrastructure/
// config/) строит эту сущность на лету при каждом findByDirection(), она
// больше не персистентная запись БД и не редактируется через API (update()
// и PUT убраны вместе с этим).
//
// Сущность физически определена в domains/service и переиспользуется в
// domains/shop той же реализацией провайдера под тем же DI-токеном (тот же
// приём, что AccountingPeriod, см. domains/service/CLAUDE.md) — сама она не
// содержит бизнес-логики, специфичной для направления, только форму
// значений. Поля обоих направлений не бывают одновременно осмысленно
// заполненными: строка direction=service использует только roappCashboxId,
// строка direction=shop — остальные три; сущность это не запрещает (в
// комбинации полей нет нарушенного инварианта, только неиспользуемые
// значения) — проверку «заполнено ли то, что нужно ИМЕННО этому
// направлению» перед обращением в ERP делает адаптер/хендлер выплаты
// (Фаза 12), не эта сущность.
export class ErpCashConfig extends AggregateRoot<ErpCashConfigProps> {
    declare protected readonly _id: AggregateID;

    static create(create: CreateErpCashConfigProps): ErpCashConfig {
        return new ErpCashConfig({
            id: randomUUID(),
            props: {
                direction: create.direction,
                roappCashboxId: create.roappCashboxId ?? null,
                roappCategoryId: create.roappCategoryId ?? null,
                moySkladExpenseItemId: create.moySkladExpenseItemId ?? null,
                moySkladIncomeItemId: create.moySkladIncomeItemId ?? null,
                organizationId: create.organizationId ?? null,
            },
        });
    }

    get direction(): AccountingDirection {
        return this.props.direction;
    }

    get roappCashboxId(): number | null {
        return this.props.roappCashboxId;
    }

    get roappCategoryId(): number | null {
        return this.props.roappCategoryId;
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
        const direction: string = this.props.direction;
        if (direction !== 'service' && direction !== 'shop') {
            throw new ArgumentInvalidException(
                `Недопустимое направление конфигурации кассы: "${direction}"`,
            );
        }
        if (
            this.props.roappCashboxId !== null &&
            (!Number.isInteger(this.props.roappCashboxId) ||
                this.props.roappCashboxId <= 0)
        ) {
            throw new ArgumentInvalidException(
                'ID кассы RemOnline должен быть положительным целым числом',
            );
        }
        if (
            this.props.roappCategoryId !== null &&
            (!Number.isInteger(this.props.roappCategoryId) ||
                this.props.roappCategoryId <= 0)
        ) {
            throw new ArgumentInvalidException(
                'ID статьи движения денег RemOnline должен быть положительным целым числом',
            );
        }
    }
}
