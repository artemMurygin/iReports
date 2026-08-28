import { randomUUID } from 'crypto';
import type { ErpCashDocumentKind, ExternalSystem } from 'ireports-contracts';
import { AggregateRoot } from '@/shared/domain/aggregate-root.base';
import { AggregateID } from '@/shared/domain/entity.base';
import { ArgumentInvalidException } from '@/shared/exceptions';

export type ShopErpCashDocumentProps = {
    transactionId: string;
    system: ExternalSystem;
    kind: ErpCashDocumentKind;
    // Целые рубли, без знака — знак направления несёт kind.
    amount: number;
    externalId: string;
};

export type CreateShopErpCashDocumentProps = ShopErpCashDocumentProps;

// Связка «движение баланса → документ ERP» направления shop (PRD 3
// docs/payroll-closing-and-accrual/prd-salary-payout-and-erp-cash-documents.md)
// — до Фазы 4 docs/service-shop-boundary-violations-fix переиспользовала
// класс ErpCashDocument, физически определённый в domains/service (см. WHY,
// который был там, и §2.2 docs/service-shop-boundary-violations.md — цикл
// Shop.moysklad-cash-document.adapter → Service.accounting). С Фазы 4 —
// собственный независимый класс: репозиторий на его основе (см.
// application/ports/shop-erp-cash-document-repository.port.ts) читает/пишет
// ФИЗИЧЕСКИ ТУ ЖЕ таблицу erp_cash_documents (см. prisma/schema/erp-cash.prisma
// — таблицы между service/shop не разбиваются, backend/CLAUDE.md), но
// всегда подставляет/фильтрует direction = 'shop' — то же самое разделение,
// каким уже пользуются SalaryRule/TaskCompletion (Prisma-дискриминатор
// direction на общей таблице).
export class ShopErpCashDocument extends AggregateRoot<ShopErpCashDocumentProps> {
    declare protected readonly _id: AggregateID;

    static create(create: CreateShopErpCashDocumentProps): ShopErpCashDocument {
        return new ShopErpCashDocument({
            id: randomUUID(),
            props: { ...create },
        });
    }

    get transactionId(): string {
        return this.props.transactionId;
    }

    get system(): ExternalSystem {
        return this.props.system;
    }

    get kind(): ErpCashDocumentKind {
        return this.props.kind;
    }

    get amount(): number {
        return this.props.amount;
    }

    get externalId(): string {
        return this.props.externalId;
    }

    validate(): void {
        if (!this.props.transactionId) {
            throw new ArgumentInvalidException(
                'Документ ERP должен ссылаться на движение баланса',
            );
        }
        if (!Number.isInteger(this.props.amount) || this.props.amount < 0) {
            throw new ArgumentInvalidException(
                'Сумма документа ERP должна быть целым неотрицательным числом рублей',
            );
        }
        if (!this.props.externalId) {
            throw new ArgumentInvalidException(
                'Документ ERP должен ссылаться на внешний id',
            );
        }
    }
}
