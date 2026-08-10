import { ValueObject } from '@/shared/domain/value-object.base';
import { ArgumentInvalidException } from '@/shared/exceptions';
import type { SalesDirection } from 'ireports-contracts';

export interface SalesPlanScopeProps {
    direction: SalesDirection;
    department: number;
    category: number | null;
}

// На что именно указывает план/строка шаблона — направление, отдел и,
// опционально, категория. Тройка всегда меняется вместе (это была бы уже
// другая строка плана, а не правка этой) и вместе задаёт естественный ключ
// (@@unique в sales.prisma), поэтому не три голых поля entity, а один
// объект — тот же принцип, что и у MotivationTarget в accounting.
export class SalesPlanScope extends ValueObject<SalesPlanScopeProps> {
    static create(
        direction: SalesDirection,
        department: number,
        category: number | null,
    ): SalesPlanScope {
        if (direction !== 'service' && direction !== 'shop') {
            throw new ArgumentInvalidException(
                `Недопустимое направление плана продаж: "${String(direction)}"`,
            );
        }
        if (!department) {
            throw new ArgumentInvalidException(
                'Необходимо указать отдел для плана продаж',
            );
        }
        if (category !== null && !category) {
            throw new ArgumentInvalidException(
                'Категория плана продаж должна быть либо положительным числом, либо отсутствовать',
            );
        }
        return new SalesPlanScope({ direction, department, category });
    }

    getDirection(): SalesDirection {
        return this.props.direction;
    }

    getDepartment(): number {
        return this.props.department;
    }

    getCategory(): number | null {
        return this.props.category;
    }
}
