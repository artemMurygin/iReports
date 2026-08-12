import { randomUUID } from 'crypto';
import { AggregateID, Entity } from '@/shared/domain/entity.base';
import { ArgumentInvalidException } from '@/shared/exceptions';
import { Period } from '@/shared/domain/period.value-object';
import { SalesPlanScope } from '../value-objects/sales-plan-scope.value-object';
import { SalesPlanApproval } from '../value-objects/sales-plan-approval.value-object';
import {
    SalesPlanCreateProps,
    SalesPlanEditProps,
    SalesPlanProps,
    SalesDirection,
    SalesPlanSource,
    SalesPlanStatus,
} from '../types/sales-plan.types';

// План на конкретный месяц по отделу и, опционально, категории — вход для
// всех процентных зарплатных правил (Фаза 3, см.
// docs/payroll/plan-payroll-calculation.md). Направление/отдел/категория и
// период неизменны после создания (правка на другую комбинацию — это
// создание новой строки, а не update этой).
export class SalesPlan extends Entity<SalesPlanProps> {
    declare protected readonly _id: AggregateID;

    static create(create: SalesPlanCreateProps): SalesPlan {
        const scope = SalesPlanScope.create(
            create.direction,
            create.department,
            create.category ?? null,
        );
        return new SalesPlan({
            id: randomUUID(),
            props: {
                scope,
                period: create.period,
                turnover: create.turnover,
                margin: create.margin,
                source: create.source,
                status: 'CREATED',
                approval: null,
            },
        });
    }

    get direction(): SalesDirection {
        return this.props.scope.getDirection();
    }

    get department(): number {
        return this.props.scope.getDepartment();
    }

    get category(): string | null {
        return this.props.scope.getCategory();
    }

    get period(): string {
        return this.props.period;
    }

    get turnover(): number {
        return this.props.turnover;
    }

    get margin(): number {
        return this.props.margin;
    }

    get source(): SalesPlanSource {
        return this.props.source;
    }

    get status(): SalesPlanStatus {
        return this.props.status;
    }

    get approvedBy(): number | null {
        return this.props.approval?.getApprovedBy() ?? null;
    }

    get approvedAt(): Date | null {
        return this.props.approval?.getApprovedAt() ?? null;
    }

    // Ручная правка значений — не создание, не удаление, не утверждение.
    // Всегда переводит источник в MANUAL; если строка была утверждена,
    // сбрасывает статус в CREATED и снимает утверждение целиком (см.
    // docs/payroll/prd-payroll-calculation.md: "утверждать нужно то, что
    // видишь" — цифры изменились, прошлое утверждение к ним не относится).
    edit(patch: SalesPlanEditProps): void {
        if (patch.turnover !== undefined) {
            this.props.turnover = patch.turnover;
        }
        if (patch.margin !== undefined) {
            this.props.margin = patch.margin;
        }
        this.props.source = 'MANUAL';
        if (this.props.status === 'APPROVED') {
            this.props.status = 'CREATED';
            this.props.approval = null;
        }
        this.validate();
    }

    // Идемпотентно: повторное утверждение (в т.ч. в массовом сценарии
    // "утвердить весь месяц") просто обновляет approvedBy/approvedAt на
    // актуальные — отдельного запрета на переутверждение нет.
    approve(approvedBy: number): void {
        this.props.approval = SalesPlanApproval.create(approvedBy);
        this.props.status = 'APPROVED';
    }

    validate(): void {
        if (this.props.turnover < 0) {
            throw new ArgumentInvalidException(
                'Плановый оборот не может быть отрицательным',
            );
        }
        if (this.props.margin < 0) {
            throw new ArgumentInvalidException(
                'Плановая маржа не может быть отрицательной',
            );
        }
        // Бросает ArgumentInvalidException при неверном формате периода —
        // сам объект Period здесь не нужен, только валидация формата.
        Period.create(this.props.period);
    }
}
