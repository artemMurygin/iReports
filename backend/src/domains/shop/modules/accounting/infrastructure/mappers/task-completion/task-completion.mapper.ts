import type { TaskCompletionResponse } from 'ireports-contracts';
import {
    Prisma,
    TaskCompletion as TaskCompletionRecord,
} from '../../../../../../../../prisma/generated/prisma/schema/client';
import { Mapper } from '@/shared/domain/mapper.interface';
import {
    ShopTaskCompletion,
    ShopTaskCompletionStatus,
} from '@/domains/shop/modules/accounting/domain/entities/task-completion/task-completion.entity';

// Направление (record.direction) не читается в toDomain намеренно — то же
// решение, что и у TaskCompletionMapper домена service (Фаза 13.5): фильтрация
// "только записи shop" происходит на уровне Prisma-запроса в
// ShopTaskCompletionRepository (`where: { direction: 'shop' }`), поэтому сюда
// в норме не попадают чужие (service) строки, а доменная сущность
// ShopTaskCompletion направления не хранит вовсе (это исключительно
// инфраструктурный, а не доменный факт).
export class ShopTaskCompletionMapper implements Mapper<
    ShopTaskCompletion,
    Prisma.TaskCompletionCreateInput
> {
    toDomain(record: TaskCompletionRecord): ShopTaskCompletion {
        return new ShopTaskCompletion({
            id: record.id,
            createdAt: record.createdAt,
            updatedAt: record.updatedAt,
            props: {
                employeeId: record.employeeId,
                period: record.period,
                description: record.description,
                status: record.status as ShopTaskCompletionStatus,
                createdBy: record.createdBy,
                confirmedBy: record.confirmedBy,
                confirmedAt: record.confirmedAt,
            },
        });
    }

    toPersistence(
        entity: ShopTaskCompletion,
    ): Prisma.TaskCompletionCreateInput {
        return {
            id: entity.id,
            employeeId: entity.employeeId,
            period: entity.period,
            description: entity.description,
            status: entity.status,
            createdBy: entity.createdBy,
            confirmedBy: entity.confirmedBy,
            confirmedAt: entity.confirmedAt,
            // Направление записи (Фаза 13.5) — фиксированное 'shop' для
            // этого мапера: домен shop никогда не пишет чужие записи.
            // См. комментарий у TaskCompletion.direction в salary.prisma.
            direction: 'shop',
            createdAt: entity.createdAt,
            updatedAt: entity.updatedAt,
        };
    }

    toResponse(completion: ShopTaskCompletion): TaskCompletionResponse {
        return {
            id: completion.id,
            employeeId: completion.employeeId,
            period: completion.period,
            description: completion.description,
            status: completion.status,
            createdBy: completion.createdBy,
            createdAt: completion.createdAt,
            confirmedBy: completion.confirmedBy,
            confirmedAt: completion.confirmedAt,
            updatedAt: completion.updatedAt,
        };
    }
}
