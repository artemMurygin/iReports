import { Injectable } from '@nestjs/common';
import { DatabaseService } from '@/infrustructure/database/database.service';
import { PrismaRepository } from '@/shared/infrastructure/persistence/prisma.repository';
import { Task } from '@/modules/tasks/domain/entities/task.entity';
import type {
    TaskListFilter,
    TaskRepositoryPort,
} from '@/modules/tasks/application/ports/task.repository.port';
import { TaskMapper } from '../mappers/task.mapper';

@Injectable()
export class TaskRepository
    extends PrismaRepository
    implements TaskRepositoryPort
{
    private readonly mapper = new TaskMapper();

    constructor(db: DatabaseService) {
        super(db);
    }

    async insert(task: Task): Promise<void> {
        await this.write(task, (client) =>
            client.task.create({ data: this.mapper.toPersistence(task) }),
        );
    }

    async update(task: Task): Promise<void> {
        const props = task.getProps();
        await this.write(task, (client) =>
            client.task.update({
                where: { id: props.id },
                data: {
                    direction: task.direction,
                    title: task.title,
                    description: task.description,
                    deadline: task.deadline,
                    assigneeEmployeeId: task.assigneeEmployeeId,
                    status: task.status.code,
                    closedSuccessfullyAt: task.closedSuccessfullyAt,
                    updatedAt: props.updatedAt,
                },
            }),
        );
    }

    async findById(id: string): Promise<Task | null> {
        const record = await this.client.task.findUnique({ where: { id } });
        return record ? this.mapper.toDomain(record) : null;
    }

    async findManyByIds(ids: string[]): Promise<Task[]> {
        // design.md Decision 5 / architecture.md — единственный метод,
        // который accounting (service/shop) вызывает напрямую при сборе
        // taskCompletionStatuses. Пустой список — [] без похода в БД, тем
        // же приёмом, что WorkScheduleEntryRepository.findByEmployeeIdsAndDateRange.
        if (ids.length === 0) {
            return [];
        }
        const records = await this.client.task.findMany({
            where: { id: { in: ids } },
        });
        return records.map((record) => this.mapper.toDomain(record));
    }

    async findMany(filter: TaskListFilter): Promise<Task[]> {
        const records = await this.client.task.findMany({
            where: {
                ...(filter.status ? { status: filter.status } : {}),
                ...(filter.direction ? { direction: filter.direction } : {}),
            },
            orderBy: { createdAt: 'desc' },
        });
        return records.map((record) => this.mapper.toDomain(record));
    }
}
