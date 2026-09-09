import { Injectable } from '@nestjs/common';
import { DatabaseService } from '@/infrustructure/database/database.service';
import { PrismaRepository } from '@/shared/infrastructure/persistence/prisma.repository';
import { BitrixEmployeeCredentials } from '../../domain/entities/bitrix-employee-credentials.entity';
import type { BitrixEmployeeCredentialsRepositoryPort } from '../../application/ports/bitrix-employee-credentials.port';
import { BitrixEmployeeCredentialsMapper } from '../mappers/bitrix-employee-credentials.mapper';

@Injectable()
export class BitrixEmployeeCredentialsRepository
    extends PrismaRepository
    implements BitrixEmployeeCredentialsRepositoryPort
{
    private readonly mapper = new BitrixEmployeeCredentialsMapper();

    constructor(db: DatabaseService) {
        super(db);
    }

    async findByEmployeeId(
        bitrixEmployeeId: number,
    ): Promise<BitrixEmployeeCredentials | null> {
        const record = await this.client.bitrixEmployeeCredentials.findUnique({
            where: { bitrixEmployeeId },
        });
        return record ? this.mapper.toDomain(record) : null;
    }

    // 1:1 с BitrixEmployee — upsert по bitrixEmployeeId, а не insert/update
    // раздельно: и первый вход сотрудника, и последующее обновление токена
    // (BitrixTokenRefreshService) проходят через один и тот же метод.
    async upsert(entity: BitrixEmployeeCredentials): Promise<void> {
        const data = this.mapper.toPersistence(entity);
        await this.write(entity, (client) =>
            client.bitrixEmployeeCredentials.upsert({
                where: { bitrixEmployeeId: entity.bitrixEmployeeId },
                create: data,
                update: {
                    memberId: data.memberId,
                    accessToken: data.accessToken,
                    refreshToken: data.refreshToken,
                    accessExpiresAt: data.accessExpiresAt,
                },
            }),
        );
    }
}
