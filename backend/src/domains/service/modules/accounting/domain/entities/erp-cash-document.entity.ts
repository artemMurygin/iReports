import { randomUUID } from 'crypto';
import type { ErpCashDocumentKind, ExternalSystem } from 'ireports-contracts';
import { AggregateRoot } from '@/shared/domain/aggregate-root.base';
import { AggregateID } from '@/shared/domain/entity.base';
import { ArgumentInvalidException } from '@/shared/exceptions';

export type ErpCashDocumentProps = {
    transactionId: string;
    system: ExternalSystem;
    kind: ErpCashDocumentKind;
    // Целые рубли, без знака — знак направления несёт kind.
    amount: number;
    externalId: string;
};

export type CreateErpCashDocumentProps = ErpCashDocumentProps;

// Связка «движение баланса → документ ERP» (PRD 3
// docs/payroll-closing-and-accrual/prd-salary-payout-and-erp-cash-documents.md):
// существует только вместе с движением, которое её породило — либо есть
// оба, либо нет ни одного (создаётся и удаляется Фазой 12, здесь только
// форма). transactionId уникален в БД (см. Prisma-модель ErpCashDocument,
// erp-cash.prisma) — это и есть защита от задвоения, на которую опирается
// ErpCashDocumentPort.findByKey (application/ports/erp-cash-document.port.ts
// в domains/service и domains/shop): повторная попытка создать документ для
// уже обработанного движения обязана упасть на уникальном индексе БД, а не
// молча создать второй документ в самой ERP.
//
// Сущность физически определена в domains/service (тот же приём, что
// AccountingPeriod/SalaryAccrual/BalanceTransaction, см.
// domains/service/CLAUDE.md). Направление на записи отдельным полем не
// хранится (repository/mapper этого класса не различают direction на
// уровне персистентности) — до Фазы 4
// docs/service-shop-boundary-violations-fix этот же класс/репозиторий
// переиспользовался ИЗ domains/shop напрямую (MoyskladCashDocumentAdapter,
// create/delete-shop-payout.handler.ts, §2.2
// docs/service-shop-boundary-violations.md); с этой фазы у shop собственная
// независимая сущность ShopErpCashDocument
// (domains/shop/modules/accounting/domain/entities/shop-erp-cash-document.entity.ts,
// репозиторий которой фильтрует/подставляет direction = 'shop' поверх той
// же таблицы). Этот класс остаётся действительно direction-агностичным
// только там, где остался и раньше: RoappCashDocumentAdapter (service) и
// сквозной src/modules/employee-balance/ (общая лента баланса — движения
// ОБОИХ направлений вперемешку, вне доменной изоляции, см.
// backend/CLAUDE.md, "BalanceTransaction — исключение").
export class ErpCashDocument extends AggregateRoot<ErpCashDocumentProps> {
    declare protected readonly _id: AggregateID;

    static create(create: CreateErpCashDocumentProps): ErpCashDocument {
        return new ErpCashDocument({
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
