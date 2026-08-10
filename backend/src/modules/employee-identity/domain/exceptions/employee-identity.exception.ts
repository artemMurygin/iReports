import { ConflictException, NotFoundException } from '@/shared/exceptions';

// Один и тот же внешний идентификатор в одной системе не может обозначать
// двух разных сотрудников — попытка завести дубль отклоняется (см.
// employee-identity.prisma, @@unique([system, identifierType, externalId])).
export class EmployeeIdentityAlreadyExistsException extends ConflictException {}

export class EmployeeIdentityNotFoundException extends NotFoundException {
    constructor(message = 'Связь с внешней системой не найдена') {
        super(message);
    }
}
