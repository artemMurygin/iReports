import { randomUUID } from 'crypto';
import { AggregateID, Entity } from '@/shared/domain/entity.base';
import { ArgumentInvalidException } from '@/shared/exceptions';
import {
    EmployeeIdentityCreateProps,
    EmployeeIdentityProps,
    EmployeeIdentityUpdateProps,
} from '../types/employee-identity.types';

// Связь «сотрудник Bitrix × внешняя система × внешний идентификатор» (Фаза
// 2, см. docs/payroll/prd-payroll-calculation.md, раздел 1). Роль сотрудника
// здесь намеренно не хранится — это отвечает только на вопрос «кто есть
// кто», а не «в какой роли сотрудник сейчас выступает». Уникальность пары
// (system, identifierType, externalId) обеспечивается на уровне БД
// (@@unique в employee-identity.prisma) — сущность её не проверяет,
// потому что для этого нужен доступ к другим записям, а не к своим props.
export class EmployeeIdentity extends Entity<EmployeeIdentityProps> {
    declare protected readonly _id: AggregateID;

    static create(create: EmployeeIdentityCreateProps): EmployeeIdentity {
        return new EmployeeIdentity({ id: randomUUID(), props: { ...create } });
    }

    get bitrixEmployeeId(): number {
        return this.props.bitrixEmployeeId;
    }

    get system(): EmployeeIdentityProps['system'] {
        return this.props.system;
    }

    get identifierType(): EmployeeIdentityProps['identifierType'] {
        return this.props.identifierType;
    }

    get externalId(): string {
        return this.props.externalId;
    }

    // Правка меняет только сам идентификатор/его тип — сотрудник и система
    // не переезжают (см. contracts/commands/employee-identity.ts,
    // updateEmployeeIdentitySchema).
    update(patch: EmployeeIdentityUpdateProps): void {
        if (patch.identifierType !== undefined) {
            this.props.identifierType = patch.identifierType;
        }
        if (patch.externalId !== undefined) {
            this.props.externalId = patch.externalId;
        }
        this.validate();
    }

    validate(): void {
        if (!this.props.bitrixEmployeeId) {
            throw new ArgumentInvalidException(
                'Необходимо указать сотрудника Bitrix для связи EmployeeIdentity',
            );
        }
        if (!this.props.system) {
            throw new ArgumentInvalidException(
                'Необходимо указать внешнюю систему для связи EmployeeIdentity',
            );
        }
        if (!this.props.identifierType) {
            throw new ArgumentInvalidException(
                'Необходимо указать тип идентификатора для связи EmployeeIdentity',
            );
        }
        if (!this.props.externalId || !this.props.externalId.trim()) {
            throw new ArgumentInvalidException(
                'Внешний идентификатор EmployeeIdentity не может быть пустым',
            );
        }
    }
}
