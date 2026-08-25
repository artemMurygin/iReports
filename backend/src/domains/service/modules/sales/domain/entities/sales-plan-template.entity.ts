import { randomUUID } from 'crypto';
import { AggregateID, Entity } from '@/shared/domain/entity.base';
import { ArgumentInvalidException } from '@/shared/exceptions';
import { SalesPlanScope } from '../value-objects/sales-plan-scope.value-object';
import {
    SalesPlanTemplateCreateProps,
    SalesPlanTemplateEditProps,
    SalesPlanTemplateProps,
} from '../types/sales-plan-template.types';
import type { SalesDirection } from '../types/sales-plan.types';

// growthPercent по умолчанию — см. docs/payroll/prd-payroll-calculation.md,
// раздел "План продаж": "процент, на который автоматически растёт план от
// месяца к месяцу, по умолчанию 10%".
export const DEFAULT_GROWTH_PERCENT = 10;

// Дефолтные значения плана по отделу и, опционально, категории — стартовая
// точка для самого первого месяца направления и запасной вариант, если
// плана за предыдущий месяц ещё нет (Фаза 4). Не привязана к периоду.
export class SalesPlanTemplate extends Entity<SalesPlanTemplateProps> {
    declare protected readonly _id: AggregateID;

    static create(create: SalesPlanTemplateCreateProps): SalesPlanTemplate {
        const scope = SalesPlanScope.create(
            create.direction,
            create.department,
            create.category ?? null,
        );
        return new SalesPlanTemplate({
            id: randomUUID(),
            props: {
                scope,
                turnover: create.turnover,
                margin: create.margin,
                orderTypeIds: create.orderTypeIds ?? [],
                growthPercent: create.growthPercent ?? DEFAULT_GROWTH_PERCENT,
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

    get turnover(): number {
        return this.props.turnover;
    }

    get margin(): number {
        return this.props.margin;
    }

    get growthPercent(): number {
        return this.props.growthPercent;
    }

    // [] = "учитывать заказы всех типов" — переносится на автосоздаваемый
    // план (см. EnsureSalesPlansForPeriodService.fromTemplate()), когда для
    // комбинации отдел/категория нет плана предыдущего месяца.
    get orderTypeIds(): number[] {
        return this.props.orderTypeIds;
    }

    update(patch: SalesPlanTemplateEditProps): void {
        if (patch.turnover !== undefined) {
            this.props.turnover = patch.turnover;
        }
        if (patch.margin !== undefined) {
            this.props.margin = patch.margin;
        }
        if (patch.orderTypeIds !== undefined) {
            this.props.orderTypeIds = patch.orderTypeIds;
        }
        if (patch.growthPercent !== undefined) {
            this.props.growthPercent = patch.growthPercent;
        }
        this.validate();
    }

    validate(): void {
        if (this.props.turnover < 0) {
            throw new ArgumentInvalidException(
                'Плановый оборот шаблона не может быть отрицательным',
            );
        }
        if (this.props.margin < 0) {
            throw new ArgumentInvalidException(
                'Плановая маржа шаблона не может быть отрицательной',
            );
        }
        if (this.props.growthPercent < 0) {
            throw new ArgumentInvalidException(
                'Процент роста шаблона не может быть отрицательным',
            );
        }
    }
}
