import {
    BitrixEmployeeCredentials as BitrixEmployeeCredentialsRecord,
    Prisma,
} from '../../../../../prisma/generated/prisma/schema/client';
import { Mapper } from '@/shared/domain/mapper.interface';
import { BitrixEmployeeCredentials } from '../../domain/entities/bitrix-employee-credentials.entity';
import { BitrixCredentials } from '../../domain/value-objects/bitrix-credentials.value-object';

export class BitrixEmployeeCredentialsMapper
    implements
        Mapper<
            BitrixEmployeeCredentials,
            Prisma.BitrixEmployeeCredentialsCreateInput
        >
{
    toDomain(
        record: BitrixEmployeeCredentialsRecord,
    ): BitrixEmployeeCredentials {
        return BitrixEmployeeCredentials.create({
            bitrixEmployeeId: record.bitrixEmployeeId,
            memberId: record.memberId,
            credentials: BitrixCredentials.create({
                accessToken: record.accessToken,
                refreshToken: record.refreshToken,
                expiresAt: record.accessExpiresAt,
            }),
        });
    }

    toPersistence(
        entity: BitrixEmployeeCredentials,
    ): Prisma.BitrixEmployeeCredentialsCreateInput {
        return {
            bitrixEmployee: { connect: { id: entity.bitrixEmployeeId } },
            memberId: entity.memberId,
            accessToken: entity.credentials.accessToken,
            refreshToken: entity.credentials.refreshToken,
            accessExpiresAt: entity.credentials.expiresAt,
        };
    }
}
