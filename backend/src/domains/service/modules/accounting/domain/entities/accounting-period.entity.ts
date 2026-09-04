import { randomUUID } from 'crypto';
import { AggregateRoot } from '@/shared/domain/aggregate-root.base';
import { AggregateID } from '@/shared/domain/entity.base';
import { Period } from '@/shared/domain/period.value-object';
import { ArgumentInvalidException } from '@/shared/exceptions';
import type { AccountingDirection } from '@/shared/domain/calculation-context';
import { PeriodClosure } from '../value-objects/period-closure.value-object';
import {
    PeriodAlreadyClosedException,
    PeriodNotClosedException,
} from '../exceptions/accounting-period.exception';
import { AccountingPeriodClosedDomainEvent } from '../events/accounting-period-closed.domain-event';

export type AccountingPeriodStatus = 'OPEN' | 'CLOSED';

export type AccountingPeriodProps = {
    direction: AccountingDirection;
    period: Period;
    status: AccountingPeriodStatus;
    closure: PeriodClosure | null;
};

export type AccountingPeriodCreateProps = {
    direction: AccountingDirection;
    period: string;
};

// spec: service/accounting#requirement-расчётный-период-идентифицируется-направлением-и-месяцем
//
// Период, для которого ещё нет записи в БД, трактуется вызывающей стороной как OPEN (см.
// AccountingPeriodRepositoryPort.findByDirectionAndPeriod) — заводить строку заранее на каждый
// месяц не нужно, первая запись появляется при закрытии.
//
// spec: service/accounting#requirement-закрытие-периода-требует-утверждённого-плана-продаж
//
// Проверка "все строки плана продаж утверждены" — ответственность application-слоя
// (CloseAccountingPeriodHandler, знающего про модуль sales через SALES_PLAN_REPOSITORY), а не этой
// сущности: период ничего не знает про модуль sales, как и оркестратор расчёта (Фаза 1) ничего не
// знает про роли/типы правил.
export class AccountingPeriod extends AggregateRoot<AccountingPeriodProps> {
    declare protected readonly _id: AggregateID;

    static openFor(create: AccountingPeriodCreateProps): AccountingPeriod {
        return new AccountingPeriod({
            id: randomUUID(),
            props: {
                direction: create.direction,
                period: Period.create(create.period),
                status: 'OPEN',
                closure: null,
            },
        });
    }

    get direction(): AccountingDirection {
        return this.props.direction;
    }

    get period(): string {
        return this.props.period.getValue();
    }

    get status(): AccountingPeriodStatus {
        return this.props.status;
    }

    isOpen(): boolean {
        return this.props.status === 'OPEN';
    }

    isClosed(): boolean {
        return this.props.status === 'CLOSED';
    }

    get closedBy(): number | null {
        return this.props.closure?.getClosedBy() ?? null;
    }

    get closedAt(): Date | null {
        return this.props.closure?.getClosedAt() ?? null;
    }

    // employeeCount — сколько строк снапшота породило закрытие, только для
    // AccountingPeriodClosedDomainEvent (диагностика/лог), сама сущность
    // снапшот не хранит и не создаёт (это отдельный агрегат/порт, см.
    // AccountingPeriodSnapshotPort).
    close(closedBy: number, employeeCount: number): void {
        if (this.isClosed()) {
            throw new PeriodAlreadyClosedException(this.direction, this.period);
        }
        this.props.status = 'CLOSED';
        this.props.closure = PeriodClosure.create(closedBy);
        this.addEvent(
            new AccountingPeriodClosedDomainEvent({
                aggregateId: this.id,
                direction: this.direction,
                period: this.period,
                closedBy,
                employeeCount,
            }),
        );
    }

    // Повторное открытие — явное подтверждение проверяется раньше, на
    // уровне запроса (см. reopenAccountingPeriodRequestSchema — confirm:
    // z.literal(true)); удаление снапшота — тоже ответственность
    // application-слоя (снапшот отдельный агрегат/порт).
    reopen(): void {
        if (this.isOpen()) {
            throw new PeriodNotClosedException(this.direction, this.period);
        }
        this.props.status = 'OPEN';
        this.props.closure = null;
    }

    validate(): void {
        // direction типизирован через `string`, а не напрямую props.direction —
        // после исчерпывающей проверки TS сужает literal-union до `never`, и
        // eslint (restrict-template-expressions) не даёт подставить его в
        // шаблонную строку (см. тот же приём в шапке файла — направление
        // могло прийти сюда только из некорректного вызова toDomain()/API).
        const direction: string = this.props.direction;
        if (direction !== 'service' && direction !== 'shop') {
            throw new ArgumentInvalidException(
                `Недопустимое направление расчётного периода: "${direction}"`,
            );
        }
    }
}
