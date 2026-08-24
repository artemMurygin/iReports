import { randomUUID } from 'crypto';
import { AggregateRoot } from '@/shared/domain/aggregate-root.base';
import { AggregateID } from '@/shared/domain/entity.base';
import type { AccountingDirection } from '@/shared/domain/calculation-context';
import { ArgumentInvalidException } from '@/shared/exceptions';

export type ErpCashConfigProps = {
    direction: AccountingDirection;
    roappCashboxId: number | null;
    moySkladExpenseItemId: string | null;
    moySkladIncomeItemId: string | null;
    organizationId: string | null;
};

export type ErpCashConfigPatch = Partial<
    Pick<
        ErpCashConfigProps,
        | 'roappCashboxId'
        | 'moySkladExpenseItemId'
        | 'moySkladIncomeItemId'
        | 'organizationId'
    >
>;

export type CreateErpCashConfigProps = {
    direction: AccountingDirection;
} & ErpCashConfigPatch;

// Конфигурация кассы направления (PRD 3
// docs/payroll-closing-and-accrual/prd-salary-payout-and-erp-cash-documents.md:
// «Выбора кассы у пользователя нет») — одна запись на direction (Prisma
// @unique, erp-cash.prisma), заполняется администратором один раз через PUT
// /v1/{direction}/accounting/erp_cash_config, читается адаптером
// ErpCashDocumentPort перед обращением в ERP; пустая конфигурация — отказ
// до обращения в ERP (см. «Критерии готовности» PRD 3).
//
// Сущность физически определена в domains/service и переиспользуется в
// domains/shop той же реализацией репозитория под тем же DI-токеном (тот же
// приём, что AccountingPeriod, см. domains/service/CLAUDE.md) — сама запись
// не содержит бизнес-логики, специфичной для направления, только форму
// хранения. Поля обоих направлений не бывают одновременно осмысленно
// заполненными: строка direction=service использует только roappCashboxId,
// строка direction=shop — остальные три; сущность это не запрещает (в
// комбинации полей нет нарушенного инварианта, только неиспользуемые
// значения) — проверку «заполнено ли то, что нужно ИМЕННО этому
// направлению» перед обращением в ERP делает будущий адаптер/хендлер
// выплаты (Фаза 12), не эта сущность.
export class ErpCashConfig extends AggregateRoot<ErpCashConfigProps> {
    declare protected readonly _id: AggregateID;

    static create(create: CreateErpCashConfigProps): ErpCashConfig {
        return new ErpCashConfig({
            id: randomUUID(),
            props: {
                direction: create.direction,
                roappCashboxId: create.roappCashboxId ?? null,
                moySkladExpenseItemId: create.moySkladExpenseItemId ?? null,
                moySkladIncomeItemId: create.moySkladIncomeItemId ?? null,
                organizationId: create.organizationId ?? null,
            },
        });
    }

    // PUT — замена полей, переданных клиентом (put*ErpCashConfigRequestSchema
    // из contracts различает поля по направлению): поле, отсутствующее в
    // патче (undefined), не трогается, а не сбрасывается в null — иначе
    // повторный PUT одним полем стирал бы уже настроенные остальные, если
    // фронт когда-нибудь начнёт присылать поля направления shop раздельно.
    update(patch: ErpCashConfigPatch): void {
        if (patch.roappCashboxId !== undefined) {
            this.props.roappCashboxId = patch.roappCashboxId;
        }
        if (patch.moySkladExpenseItemId !== undefined) {
            this.props.moySkladExpenseItemId = patch.moySkladExpenseItemId;
        }
        if (patch.moySkladIncomeItemId !== undefined) {
            this.props.moySkladIncomeItemId = patch.moySkladIncomeItemId;
        }
        if (patch.organizationId !== undefined) {
            this.props.organizationId = patch.organizationId;
        }
    }

    get direction(): AccountingDirection {
        return this.props.direction;
    }

    get roappCashboxId(): number | null {
        return this.props.roappCashboxId;
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
    }
}
