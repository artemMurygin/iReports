import { ValueObject } from '@/shared/domain/value-object.base';
import { ArgumentInvalidException } from '@/shared/exceptions';

export type MotivationTargetType = 'Department' | 'Employee';

export interface MotivationTargetProps {
    type: MotivationTargetType;
    id: number;
}

// type принимается как голый string (а не MotivationTargetType) —
// вызывающие (мапперы Prisma, MotivationSchema.create()) получают
// targetType из непроверенного источника (БД/DTO), а не из TS-литерала;
// type guard ниже — единственная точка, где строка реально валидируется
// перед сужением типа (без неё TS-narrowing через !== для string был бы
// невозможен, а каст со стороны вызывающего сделал бы проверку мёртвым
// кодом с точки зрения типов).
function isMotivationTargetType(value: string): value is MotivationTargetType {
    return value === 'Department' || value === 'Employee';
}

// На кого действует мотивационная схема — сотрудник или отдел (см.
// MotivationRequestSchema в ireports-contracts). Пара всегда меняется
// вместе и имеет самостоятельный смысл, поэтому не два голых поля entity
// (targetType/targetId), а один объект.
export class MotivationTarget extends ValueObject<MotivationTargetProps> {
    static create(type: string, id: number): MotivationTarget {
        if (!isMotivationTargetType(type)) {
            throw new ArgumentInvalidException(
                `Недопустимый тип цели мотивационной схемы: "${type}"`,
            );
        }
        if (!id) {
            throw new ArgumentInvalidException(
                'Необходимо указать targetId для правила мотивации!',
            );
        }
        return new MotivationTarget({ type, id });
    }

    getType(): MotivationTargetType {
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
