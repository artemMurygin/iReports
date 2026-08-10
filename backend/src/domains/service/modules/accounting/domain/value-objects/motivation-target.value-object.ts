import { ValueObject } from '@/shared/domain/value-object.base';
import { ArgumentInvalidException } from '@/shared/exceptions';

export type MotivationTargetType = 'Department' | 'Employee';

export interface MotivationTargetProps {
    type: MotivationTargetType;
    id: number;
}

// На кого действует мотивационная схема — сотрудник или отдел (см.
// MotivationRequestSchema в ireports-contracts). Пара всегда меняется
// вместе и имеет самостоятельный смысл, поэтому не два голых поля entity
// (targetType/targetId), а один объект.
export class MotivationTarget extends ValueObject<MotivationTargetProps> {
    static create(type: MotivationTargetType, id: number): MotivationTarget {
        if (type !== 'Department' && type !== 'Employee') {
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
