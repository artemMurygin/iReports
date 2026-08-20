import { randomUUID } from 'crypto';
import { AggregateID, Entity } from '@/shared/domain/entity.base';
import { ArgumentInvalidException } from '@/shared/exceptions';
import { Period } from '@/shared/domain/period.value-object';
import { ShopTaskCompletionInvalidStatusTransitionException } from '@/domains/shop/modules/accounting/domain/exceptions/shop-task-completion.exception';

// Выполнение задачи сотрудником магазина — источник данных для
// TaskCompletedEntity.calculate() магазина (Фаза 13.5, зеркало
// domains/service/modules/accounting/domain/entities/task-completion.entity.ts,
// независимая реализация — общая только Prisma-таблица TaskCompletion с
// дискриминатором direction).
//
// ВАЖНО: это ВРЕМЕННЫЙ внутренний источник данных — простой двухступенчатый
// воркфлоу подтверждения (сотрудник отмечает выполненной → руководитель
// подтверждает), без какой-либо интеграции с Bitrix24 Tasks. `description`
// — произвольный текст-заглушка вместо реальной задачи Bitrix, содержимое
// сейчас не имеет значения для расчёта — важен только факт и статус.
// Синхронизация с реальными задачами Bitrix24 запланирована ОТДЕЛЬНОЙ
// будущей фазой и не реализуется здесь.
export type ShopTaskCompletionStatus =
    'PENDING_CONFIRMATION' | 'CONFIRMED' | 'REJECTED';

export interface ShopTaskCompletionProps {
    employeeId: number;
    period: string;
    description: string;
    status: ShopTaskCompletionStatus;
    createdBy: number;
    confirmedBy: number | null;
    confirmedAt: Date | null;
}

export interface ShopTaskCompletionCreateProps {
    employeeId: number;
    period: string;
    description: string;
    createdBy: number;
}

export class ShopTaskCompletion extends Entity<ShopTaskCompletionProps> {
    declare protected readonly _id: AggregateID;

    static create(props: ShopTaskCompletionCreateProps): ShopTaskCompletion {
        return new ShopTaskCompletion({
            id: randomUUID(),
            props: {
                employeeId: props.employeeId,
                period: props.period,
                description: props.description,
                status: 'PENDING_CONFIRMATION',
                createdBy: props.createdBy,
                confirmedBy: null,
                confirmedAt: null,
            },
        });
    }

    get employeeId(): number {
        return this.props.employeeId;
    }

    get period(): string {
        return this.props.period;
    }

    get description(): string {
        return this.props.description;
    }

    get status(): ShopTaskCompletionStatus {
        return this.props.status;
    }

    get createdBy(): number {
        return this.props.createdBy;
    }

    get confirmedBy(): number | null {
        return this.props.confirmedBy;
    }

    get confirmedAt(): Date | null {
        return this.props.confirmedAt;
    }

    isConfirmed(): boolean {
        return this.props.status === 'CONFIRMED';
    }

    // Подтверждение/отклонение — единственный переход после создания,
    // только из PENDING_CONFIRMATION (повторное подтверждение/отклонение
    // уже решённой записи отклоняется — см. решение в шапке файла: статус
    // фиксирует однократное действие руководителя).
    confirm(confirmedBy: number): void {
        this.transition('CONFIRMED', confirmedBy);
    }

    reject(confirmedBy: number): void {
        this.transition('REJECTED', confirmedBy);
    }

    private transition(
        status: 'CONFIRMED' | 'REJECTED',
        confirmedBy: number,
    ): void {
        if (this.props.status !== 'PENDING_CONFIRMATION') {
            throw new ShopTaskCompletionInvalidStatusTransitionException(
                this.props.status,
            );
        }
        this.props.status = status;
        this.props.confirmedBy = confirmedBy;
        this.props.confirmedAt = new Date();
        this.validate();
    }

    validate(): void {
        if (
            !Number.isInteger(this.props.employeeId) ||
            this.props.employeeId <= 0
        ) {
            throw new ArgumentInvalidException(
                'Необходимо указать корректный id сотрудника для записи о выполнении задачи',
            );
        }
        Period.create(this.props.period);
        if (this.props.description.trim().length === 0) {
            throw new ArgumentInvalidException(
                'Описание выполненной задачи не может быть пустым',
            );
        }
        if (
            !Number.isInteger(this.props.createdBy) ||
            this.props.createdBy <= 0
        ) {
            throw new ArgumentInvalidException(
                'Необходимо указать корректный id автора записи о выполнении задачи',
            );
        }
    }
}
