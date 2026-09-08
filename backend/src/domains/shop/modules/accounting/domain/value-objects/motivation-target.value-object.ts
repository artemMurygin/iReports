import { ValueObject } from '@/shared/domain/value-object.base';
import { ArgumentInvalidException } from '@/shared/exceptions';

export type ShopMotivationTargetType = 'Department' | 'Employee';

export interface ShopMotivationTargetProps {
    type: ShopMotivationTargetType;
    id: number;
}

// type принимается как голый string (а не ShopMotivationTargetType) —
// вызывающие (мапперы Prisma, ShopMotivationSchema.create()) получают
// targetType из непроверенного источника (БД/DTO), а не из TS-литерала;
// type guard ниже — единственная точка, где строка реально валидируется
// перед сужением типа (без неё TS-narrowing через !== для string был бы
// невозможен, а каст со стороны вызывающего сделал бы проверку мёртвым
// кодом с точки зрения типов).
function isShopMotivationTargetType(
    value: string,
): value is ShopMotivationTargetType {
    return value === 'Department' || value === 'Employee';
}

// Зеркало domains/service/modules/accounting/domain/value-objects/
// motivation-target.value-object.ts (Фаза 13.5, issue #57) — независимая
// копия для направления shop. На кого действует мотивационная схема —
// сотрудник или отдел (см. ShopMotivationRequestSchema в
// ireports-contracts). Пара всегда меняется вместе и имеет
// самостоятельный смысл, поэтому не два голых поля entity
// (targetType/targetId), а один объект.
export class ShopMotivationTarget extends ValueObject<ShopMotivationTargetProps> {
    static create(type: string, id: number): ShopMotivationTarget {
        if (!isShopMotivationTargetType(type)) {
            throw new ArgumentInvalidException(
                `Недопустимый тип цели мотивационной схемы: "${type}"`,
            );
        }
        if (!id) {
            throw new ArgumentInvalidException(
                'Необходимо указать targetId для правила мотивации!',
            );
        }
        return new ShopMotivationTarget({ type, id });
    }

    getType(): ShopMotivationTargetType {
        return this.props.type;
    }

    getId(): number {
        return this.props.id;
    }

    isDepartment(): boolean {
        return this.props.type === 'Department';
    }

    isEmployee(): boolean {
        return this.props.type === 'Employee';
    }
}
