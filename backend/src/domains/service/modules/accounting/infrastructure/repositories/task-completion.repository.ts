import { Injectable } from '@nestjs/common';
import { DatabaseService } from '@/infrustructure/database/database.service';
import { PrismaRepository } from '@/shared/infrastructure/persistence/prisma.repository';
import { TaskCompletion } from '@/domains/service/modules/accounting/domain/entities/task-completion.entity';
import { TaskCompletionRepositoryPort } from '@/domains/service/modules/accounting/application/ports/task-completion.port';
import { TaskCompletionMapper } from '../mappers/task-completion.mapper';

@Injectable()
export class TaskCompletionRepository
    extends PrismaRepository
    implements TaskCompletionRepositoryPort
{
    private readonly mapper = new TaskCompletionMapper();

    constructor(db: DatabaseService) {
        super(db);
    }

    async insert(entity: TaskCompletion): Promise<void> {
        await this.write(entity, (client) =>
            client.taskCompletion.create({
                data: this.mapper.toPersistence(entity),
            }),
        );
    }

    async update(entity: TaskCompletion): Promise<void> {
        await this.write(entity, (client) =>
            client.taskCompletion.update({
                where: { id: entity.id },
                data: {
                    status: entity.status,
                    confirmedBy: entity.confirmedBy,
                    confirmedAt: entity.confirmedAt,
                },
            }),
        );
    }

    async delete(id: string): Promise<void> {
        await this.write(null, (client) =>
            client.taskCompletion.delete({ where: { id } }),
        );
    }

    async findById(id: string): Promise<TaskCompletion | null> {
        const record = await this.client.taskCompletion.findUnique({
            where: { id },
        });
        return record ? this.mapper.toDomain(record) : null;
    }

    async findByPeriod(
        period: string,
        employeeId?: number,
    ): Promise<TaskCompletion[]> {
        const records = await this.client.taskCompletion.findMany({
            where: { period, ...(employeeId !== undefined && { employeeId }) },
            orderBy: { createdAt: 'asc' },
        });
        return records.map((record) => this.mapper.toDomain(record));
    }

    async findConfirmedByPeriod(period: string): Promise<TaskCompletion[]> {
        const records = await this.client.taskCompletion.findMany({
            where: { period, status: 'CONFIRMED' },
        });
        return records.map((record) => this.mapper.toDomain(record));
    }
}
