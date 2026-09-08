import {
    EmployeeIdentity as EmployeeIdentityRecord,
    Prisma,
} from '../../../../../prisma/generated/prisma/schema/client';
import { Mapper } from '@/shared/domain/mapper.interface';
import { EmployeeIdentity } from '../../domain/entities/employee-identity.entity';

export class EmployeeIdentityMapper implements Mapper<
    EmployeeIdentity,
    Prisma.EmployeeIdentityCreateInput
> {
    toDomain(record: EmployeeIdentityRecord): EmployeeIdentity {
        return new EmployeeIdentity({
            id: record.id,
            createdAt: record.createdAt,
            updatedAt: record.updatedAt,
            props: {
                bitrixEmployeeId: record.bitrixEmployeeId,
                system: record.system,
                identifierType: record.identifierType,
                externalId: record.externalId,
            },
        });
    }

    toPersistence(
        entity: EmployeeIdentity,
    ): Prisma.EmployeeIdentityCreateInput {
        const props = entity.getProps();
        return {
            id: props.id,
            bitrixEmployee: { connect: { id: props.bitrixEmployeeId } },
            system: props.system,
            identifierType: props.identifierType,
            externalId: props.externalId,
            createdAt: props.createdAt,
            updatedAt: props.updatedAt,
        };
    }
}
