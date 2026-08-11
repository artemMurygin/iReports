import { Injectable } from '@nestjs/common';
import { DatabaseService } from '@/infrustructure/database/database.service';
import { PrismaRepository } from '@/shared/infrastructure/persistence/prisma.repository';
import { EmployeeHoursEntry } from '@/domains/service/modules/accounting/domain/entities/employee-hours-entry.entity';
import { EmployeeHoursEntryRepositoryPort } from '@/domains/service/modules/accounting/application/ports/employee-hours-entry.port';
import { EmployeeHoursEntryMapper } from '../mappers/employee-hours-entry.mapper';

@Injectable()
export class EmployeeHoursEntryRepository
    extends PrismaRepository
    implements EmployeeHoursEntryRepositoryPort
{
    private readonly mapper = new EmployeeHoursEntryMapper();

    constructor(db: DatabaseService) {
        super(db);
    }

    async insert(entity: EmployeeHoursEntry): Promise<void> {
        await this.write(entity, (client) =>
            client.employeeHoursEntry.create({
                data: this.mapper.toPersistence(entity),
            }),
        );
    }

    async update(entity: EmployeeHoursEntry): Promise<void> {
        const props = entity.getProps();
        await this.write(entity, (client) =>
            client.employeeHoursEntry.update({
                where: { id: props.id },
                data: { hours: entity.hours },
            }),
        );
    }

    async delete(id: string): Promise<void> {
        await this.write(null, (client) =>
            client.employeeHoursEntry.delete({ where: { id } }),
        );
    }

    async findById(id: string): Promise<EmployeeHoursEntry | null> {
        const record = await this.client.employeeHoursEntry.findUnique({
            where: { id },
        });
        return record ? this.mapper.toDomain(record) : null;
    }

    async findByEmployeeAndPeriod(
        employeeId: number,
        period: string,
    ): Promise<EmployeeHoursEntry | null> {
        const record = await this.client.employeeHoursEntry.findUnique({
            where: { employeeId_period: { employeeId, period } },
        });
        return record ? this.mapper.toDomain(record) : null;
    }

    async findByPeriod(period: string): Promise<EmployeeHoursEntry[]> {
        const records = await this.client.employeeHoursEntry.findMany({
            where: { period },
            orderBy: { employeeId: 'asc' },
        });
        return records.map((record) => this.mapper.toDomain(record));
    }
}
