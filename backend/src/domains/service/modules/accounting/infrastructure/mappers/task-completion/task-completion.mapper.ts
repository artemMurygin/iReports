import type { TaskCompletionResponse } from 'ireports-contracts';
import {
    Prisma,
    TaskCompletion as TaskCompletionRecord,
} from '../../../../../../../../prisma/generated/prisma/schema/client';
import { Mapper } from '@/shared/domain/mapper.interface';
import {
    TaskCompletion,
    TaskCompletionStatus,
} from '@/domains/service/modules/accounting/domain/entities/task-completion.entity';

// Направление (record.direction) не читается в toDomain намеренно — то же
// решение, что и у SalaryRuleMapper сервиса (Фаза 12): фильтрация "только
// записи service" происходит на уровне Prisma-запроса в
// TaskCompletionRepository (`where: { direction: 'service' }`, Фаза 13,
// issue #64), поэтому сюда в норме не попадают чужие (shop) строки, а
// доменная сущность TaskCompletion направления не хранит вовсе (это
// исключительно инфраструктурный, а не доменный факт).
export class TaskCompletionMapper implements Mapper<
    TaskCompletion,
    Prisma.TaskCompletionCreateInput
> {
    toDomain(record: TaskCompletionRecord): TaskCompletion {
        return new TaskCompletion({
            id: record.id,
            createdAt: record.createdAt,
            updatedAt: record.updatedAt,
            props: {
                employeeId: record.employeeId,
                period: record.period,
                description: record.description,
                status: record.status as TaskCompletionStatus,
                createdBy: record.createdBy,
                confirmedBy: record.confirmedBy,
                confirmedAt: record.confirmedAt,
            },
        });
    }

    toPersistence(entity: TaskCompletion): Prisma.TaskCompletionCreateInput {
        return {
            id: entity.id,
            employeeId: entity.employeeId,
            period: entity.period,
            description: entity.description,
            status: entity.status,
            createdBy: entity.createdBy,
            confirmedBy: entity.confirmedBy,
            confirmedAt: entity.confirmedAt,
            // Направление записи (Фаза 13) — фиксированное 'service' для
            // этого мапера: домен service никогда не пишет чужие записи.
            // См. комментарий у TaskCompletion.direction в salary.prisma.
            direction: 'service',
            createdAt: entity.createdAt,
            updatedAt: entity.updatedAt,
        };
    }

    toResponse(completion: TaskCompletion): TaskCompletionResponse {
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
