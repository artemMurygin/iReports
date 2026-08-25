import { Injectable } from '@nestjs/common';
import { DatabaseService } from '@/infrustructure/database/database.service';
import { PrismaRepository } from '@/shared/infrastructure/persistence/prisma.repository';
import { WorkScheduleEntry } from '@/modules/work-schedule/domain/entities/work-schedule-entry.entity';
import { WorkScheduleEntryRepositoryPort } from '@/modules/work-schedule/application/ports/work-schedule-entry.port';
import { ScheduleDate } from '@/modules/work-schedule/domain/value-objects/schedule-date.value-object';
import { WorkScheduleEntryMapper } from '../mappers/work-schedule-entry.mapper';

@Injectable()
export class WorkScheduleEntryRepository
    extends PrismaRepository
    implements WorkScheduleEntryRepositoryPort
{
    private readonly mapper = new WorkScheduleEntryMapper();

    constructor(db: DatabaseService) {
        super(db);
    }

    async insert(entity: WorkScheduleEntry): Promise<void> {
        await this.write(entity, (client) =>
            client.workScheduleEntry.create({
                data: this.mapper.toPersistence(entity),
            }),
        );
    }

    async update(entity: WorkScheduleEntry): Promise<void> {
        const props = entity.getProps();
        await this.write(entity, (client) =>
            client.workScheduleEntry.update({
                where: { id: props.id },
                data: {
                    status: entity.day.status,
                    hours: entity.day.hours,
                    role: entity.day.role,
                    isOnDuty: entity.day.isOnDuty,
                    updatedAt: props.updatedAt,
                },
            }),
        );
    }

    async delete(id: string): Promise<void> {
        await this.write(null, (client) =>
            client.workScheduleEntry.delete({ where: { id } }),
        );
    }

    async findById(id: string): Promise<WorkScheduleEntry | null> {
        const record = await this.client.workScheduleEntry.findUnique({
            where: { id },
        });
        return record ? this.mapper.toDomain(record) : null;
    }

    async findByEmployeeAndDate(
        employeeId: number,
        date: string,
    ): Promise<WorkScheduleEntry | null> {
        const record = await this.client.workScheduleEntry.findUnique({
            where: {
                employeeId_date: {
                    employeeId,
                    date: ScheduleDate.create(date).toDate(),
                },
            },
        });
        return record ? this.mapper.toDomain(record) : null;
    }

    async findByEmployeeIdsAndDateRange(
        employeeIds: number[],
        from: Date,
        to: Date,
    ): Promise<WorkScheduleEntry[]> {
        // Пустой список сотрудников (отдел без людей) — вернуть [] без
        // похода в БД, а не выполнять IN () заведомо пустым результатом.
        if (employeeIds.length === 0) {
            return [];
        }
        const records = await this.client.workScheduleEntry.findMany({
            where: {
                employeeId: { in: employeeIds },
                date: { gte: from, lte: to },
            },
        });
        return records.map((record) => this.mapper.toDomain(record));
    }
}
