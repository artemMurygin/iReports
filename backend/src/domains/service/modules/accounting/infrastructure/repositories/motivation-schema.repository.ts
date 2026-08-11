import { Injectable } from '@nestjs/common';
import { DatabaseService } from '@/infrustructure/database/database.service';
import { MotivationSchema } from '@/domains/service/modules/accounting/domain/entities/motivation-schema.entity';
import { MotivationSchemaRepositoryPort } from '@/domains/service/modules/accounting/application/ports/motivation-schema.port';
import { PrismaRepository } from '@/shared/infrastructure/persistence/prisma.repository';
import { MotivationSchemaMapper } from '../mappers/motivation-schema.mapper';

@Injectable()
export class MotivationSchemaRepository
    extends PrismaRepository
    implements MotivationSchemaRepositoryPort
{
    private readonly mapper = new MotivationSchemaMapper();

    constructor(db: DatabaseService) {
        super(db);
    }

    async insert(entity: MotivationSchema): Promise<void> {
        // write() сам оборачивает запись в транзакцию (даже одиночную) и
        // после коммита опубликует MotivationSchemaCreatedDomainEvent,
        // накопленный на entity в MotivationSchema.create().
        await this.write(entity, (client) =>
            client.motivationSchema.create({
                data: this.mapper.toPersistence(entity),
            }),
        );
    }

    async findByEmployee(employeeId: number): Promise<MotivationSchema | null> {
        // Чтение, а не запись — идёт через this.client (подхватывает
        // открытую транзакцию, если есть), а не через write().
        const record = await this.client.motivationSchema.findFirst({
            where: { targetType: 'Employee', targetId: employeeId },
            include: { rules: true },
        });

        return record ? this.mapper.toDomain(record) : null;
    }

    async findAllEmployeeTargets(): Promise<MotivationSchema[]> {
        const records = await this.client.motivationSchema.findMany({
            where: { targetType: 'Employee' },
            include: { rules: true },
        });

        return records.map((record) => this.mapper.toDomain(record));
    }

    async findByEmployees(employeeIds: number[]): Promise<MotivationSchema[]> {
        if (employeeIds.length === 0) {
            return [];
        }
        const records = await this.client.motivationSchema.findMany({
            where: { targetType: 'Employee', targetId: { in: employeeIds } },
            include: { rules: true },
        });

        return records.map((record) => this.mapper.toDomain(record));
    }
}
