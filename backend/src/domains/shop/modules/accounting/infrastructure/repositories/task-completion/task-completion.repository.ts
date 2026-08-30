import { Injectable } from '@nestjs/common';
import { DatabaseService } from '@/infrustructure/database/database.service';
import { PrismaRepository } from '@/shared/infrastructure/persistence/prisma.repository';
import { ShopTaskCompletion } from '@/domains/shop/modules/accounting/domain/entities/task-completion/task-completion.entity';
import { ShopTaskCompletionRepositoryPort } from '@/domains/shop/modules/accounting/application/ports/task-completion/task-completion.port';
import { ShopTaskCompletionMapper } from '../../mappers/task-completion/task-completion.mapper';

@Injectable()
export class ShopTaskCompletionRepository
    extends PrismaRepository
    implements ShopTaskCompletionRepositoryPort
{
    private readonly mapper = new ShopTaskCompletionMapper();

    constructor(db: DatabaseService) {
        super(db);
    }

    async insert(entity: ShopTaskCompletion): Promise<void> {
        await this.write(entity, (client) =>
            client.taskCompletion.create({
                data: this.mapper.toPersistence(entity),
            }),
        );
    }

    async update(entity: ShopTaskCompletion): Promise<void> {
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

    async findById(id: string): Promise<ShopTaskCompletion | null> {
        const record = await this.client.taskCompletion.findUnique({
            where: { id },
        });
        return record ? this.mapper.toDomain(record) : null;
    }

    async findByPeriod(
        period: string,
        employeeId?: number,
    ): Promise<ShopTaskCompletion[]> {
        const records = await this.client.taskCompletion.findMany({
            // direction: 'shop' (Фаза 13.5) — та же коллизия и то же
            // решение, что и у TaskCompletionRepository домена service: без
            // фильтра сюда попали бы и записи, заведённые CQRS-модулем
            // service (см. комментарий у TaskCompletion.direction в
            // salary.prisma).
            where: {
                period,
                direction: 'shop',
                ...(employeeId !== undefined && { employeeId }),
            },
            orderBy: { createdAt: 'asc' },
        });
        return records.map((record) => this.mapper.toDomain(record));
    }

    async findConfirmedByPeriod(period: string): Promise<ShopTaskCompletion[]> {
        const records = await this.client.taskCompletion.findMany({
            where: { period, status: 'CONFIRMED', direction: 'shop' },
        });
        return records.map((record) => this.mapper.toDomain(record));
    }
}
