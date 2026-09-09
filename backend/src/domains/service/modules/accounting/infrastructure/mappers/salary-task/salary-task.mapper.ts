import {
    Prisma,
    SalaryTask as SalaryTaskRecord,
} from '../../../../../../../../prisma/generated/prisma/schema/client';
import { Mapper } from '@/shared/domain/mapper.interface';
import { SalaryTask } from '@/domains/service/modules/accounting/domain/entities/salary-task/salary-task.entity';
import { TaskStatus } from '@/domains/service/modules/accounting/domain/value-objects/task-status.value-object';

// Раздел 9 tasks.md (add-task-based-salary-rule): direction='service' —
// фиксировано мапером при записи (тот же приём, что SalaryRuleMapper,
// infrastructure/mappers/motivation-schema/salary-rule.mapper.ts) — domains/
// service никогда не пишет чужие строки общей таблицы salary_tasks.
export class SalaryTaskMapper implements Mapper<
    SalaryTask,
    Prisma.SalaryTaskUncheckedCreateInput
> {
    toDomain(record: SalaryTaskRecord): SalaryTask {
        return new SalaryTask({
            id: record.id,
            createdAt: record.createdAt,
            updatedAt: record.updatedAt,
            props: {
                salaryRuleId: record.salaryRuleId,
                period: record.period,
                deadline: record.deadline,
                isRecurring: record.isRecurring,
                bitrixTaskId: record.bitrixTaskId,
                taskStatus: TaskStatus.fromRaw(record.taskStatus),
                lastSyncedAt: record.lastSyncedAt,
            },
        });
    }

    toPersistence(entity: SalaryTask): Prisma.SalaryTaskUncheckedCreateInput {
        const props = entity.getProps();
        return {
            id: entity.id,
            salaryRuleId: entity.salaryRuleId,
            direction: 'service',
            period: entity.period,
            deadline: entity.deadline,
            isRecurring: entity.isRecurring,
            bitrixTaskId: entity.bitrixTaskId,
            taskStatus: entity.taskStatus.code,
            lastSyncedAt: entity.lastSyncedAt,
            createdAt: props.createdAt,
            updatedAt: props.updatedAt,
        };
    }
}
