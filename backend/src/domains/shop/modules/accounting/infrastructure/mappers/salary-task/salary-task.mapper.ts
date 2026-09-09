import {
    SalaryTask as SalaryTaskRecord,
    Prisma,
} from '../../../../../../../../prisma/generated/prisma/schema/client';
import { Mapper } from '@/shared/domain/mapper.interface';
import { ShopSalaryTask } from '@/domains/shop/modules/accounting/domain/entities/salary-task/salary-task.entity';
import { ShopTaskStatus } from '@/domains/shop/modules/accounting/domain/value-objects/task-status.value-object';
import { Period } from '@/shared/domain/period.value-object';

// Раздел 14 tasks.md (add-task-based-salary-rule) — независимая копия
// маппера (зеркало domains/service/modules/accounting/infrastructure/
// mappers/salary-task/salary-task.mapper.ts, раздел 9, issue #57).
// direction записывается фиксированным 'shop' в toPersistence() и не
// читается из record в toDomain() — строки этого направления и так
// фильтруются ShopSalaryTaskRepository (`where: { direction: 'shop' }`),
// тот же приём, что и в ShopSalaryRuleMapper/ShopAccountingPeriodMapper.
export class ShopSalaryTaskMapper implements Mapper<
    ShopSalaryTask,
    Prisma.SalaryTaskUncheckedCreateInput
> {
    toDomain(record: SalaryTaskRecord): ShopSalaryTask {
        return new ShopSalaryTask({
            id: record.id,
            createdAt: record.createdAt,
            updatedAt: record.updatedAt,
            props: {
                salaryRuleId: record.salaryRuleId,
                period: Period.create(record.period),
                deadline: record.deadline,
                isRecurring: record.isRecurring,
                bitrixTaskId: record.bitrixTaskId,
                taskStatus: ShopTaskStatus.fromRaw(record.taskStatus),
                lastSyncedAt: record.lastSyncedAt,
            },
        });
    }

    toPersistence(
        entity: ShopSalaryTask,
    ): Prisma.SalaryTaskUncheckedCreateInput {
        const props = entity.getProps();
        return {
            id: props.id,
            salaryRuleId: entity.salaryRuleId,
            direction: 'shop',
            period: entity.period.getValue(),
            deadline: entity.deadline,
            isRecurring: entity.isRecurring,
            bitrixTaskId: entity.bitrixTaskId,
            taskStatus: entity.taskStatus.getValue(),
            lastSyncedAt: entity.lastSyncedAt,
            createdAt: props.createdAt,
            updatedAt: props.updatedAt,
        };
    }
}
