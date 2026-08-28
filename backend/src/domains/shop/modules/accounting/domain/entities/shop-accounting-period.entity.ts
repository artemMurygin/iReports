import { randomUUID } from 'crypto';
import { AggregateRoot } from '@/shared/domain/aggregate-root.base';
import { AggregateID } from '@/shared/domain/entity.base';
import { Period } from '@/shared/domain/period.value-object';
import { ShopPeriodClosure } from '../value-objects/shop-period-closure.value-object';
import {
    ShopPeriodAlreadyClosedException,
    ShopPeriodNotClosedException,
} from '../exceptions/shop-accounting-period.exception';
import { ShopAccountingPeriodClosedDomainEvent } from '../events/shop-accounting-period-closed.domain-event';

export type ShopAccountingPeriodStatus = 'OPEN' | 'CLOSED';

export type ShopAccountingPeriodProps = {
    period: Period;
    status: ShopAccountingPeriodStatus;
    closure: ShopPeriodClosure | null;
};

// Зеркало domains/service/modules/accounting/domain/entities/
// accounting-period.entity.ts (Фаза 5 docs/service-shop-boundary-violations-fix)
// — независимая копия для направления shop. В отличие от сервисной сущности
// здесь нет поля `direction`: направление зафиксировано самим расположением
// класса в домене shop (инфраструктурный слой — ShopAccountingPeriodRepository
// — подставляет `direction: 'shop'` при работе с общей Prisma-таблицей
// accounting_periods, см. shop-accounting-period.mapper.ts), тот же приём,
// что уже применён у ShopTaskCompletion (см. domains/shop/CLAUDE.md). Период,
// для которого ещё нет записи в БД, трактуется вызывающей стороной как OPEN
// (см. ShopAccountingPeriodRepositoryPort.findByPeriod) — заводить строку
// заранее на каждый месяц не нужно, первая запись появляется при закрытии.
//
// Проверка "все строки плана продаж утверждены" — ответственность
// application-слоя (CloseShopAccountingPeriodHandler), а не этой сущности.
export class ShopAccountingPeriod extends AggregateRoot<ShopAccountingPeriodProps> {
    declare protected readonly _id: AggregateID;

    static openFor(period: string): ShopAccountingPeriod {
        return new ShopAccountingPeriod({
            id: randomUUID(),
            props: {
                period: Period.create(period),
                status: 'OPEN',
                closure: null,
            },
        });
    }

    get period(): string {
        return this.props.period.getValue();
    }

    get status(): ShopAccountingPeriodStatus {
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
    // ShopAccountingPeriodClosedDomainEvent (диагностика/лог), сама сущность
    // снапшот не хранит и не создаёт (см. ShopAccountingPeriodSnapshotPort).
    close(closedBy: number, employeeCount: number): void {
        if (this.isClosed()) {
            throw new ShopPeriodAlreadyClosedException(this.period);
        }
        this.props.status = 'CLOSED';
        this.props.closure = ShopPeriodClosure.create(closedBy);
        this.addEvent(
            new ShopAccountingPeriodClosedDomainEvent({
                aggregateId: this.id,
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
            throw new ShopPeriodNotClosedException(this.period);
        }
        this.props.status = 'OPEN';
        this.props.closure = null;
    }

    validate(): void {
        // Направление зафиксировано типом (нет поля direction) — проверять
        // здесь нечего, Period.create() уже провалидировал период на этапе
        // создания props.
    }
}
