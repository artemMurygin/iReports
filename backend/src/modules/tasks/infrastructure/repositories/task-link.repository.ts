import { Injectable } from '@nestjs/common';
import { DatabaseService } from '@/infrustructure/database/database.service';
import { PrismaRepository } from '@/shared/infrastructure/persistence/prisma.repository';
import { TaskLink } from '@/modules/tasks/domain/entities/task-link.entity';
import type { TaskLinkRepositoryPort } from '@/modules/tasks/application/ports/task-link.repository.port';
import { TaskLinkMapper } from '../mappers/task-link.mapper';

@Injectable()
export class TaskLinkRepository
    extends PrismaRepository
    implements TaskLinkRepositoryPort
{
    private readonly mapper = new TaskLinkMapper();

    constructor(db: DatabaseService) {
        super(db);
    }

    async insert(link: TaskLink): Promise<void> {
        await this.write(link, (client) =>
            client.taskLink.create({ data: this.mapper.toPersistence(link) }),
        );
    }

    async findByTaskId(taskId: string): Promise<TaskLink[]> {
        const records = await this.client.taskLink.findMany({
            where: { taskId },
            orderBy: { createdAt: 'asc' },
        });
        return records.map((record) => this.mapper.toDomain(record));
    }

    async delete(linkId: string): Promise<void> {
        await this.write(null, (client) =>
            client.taskLink.delete({ where: { id: linkId } }),
        );
    }
}
