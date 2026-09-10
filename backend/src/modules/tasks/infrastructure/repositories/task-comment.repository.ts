import { Injectable } from '@nestjs/common';
import { DatabaseService } from '@/infrustructure/database/database.service';
import { PrismaRepository } from '@/shared/infrastructure/persistence/prisma.repository';
import { TaskComment } from '@/modules/tasks/domain/entities/task-comment.entity';
import type { TaskCommentRepositoryPort } from '@/modules/tasks/application/ports/task-comment.repository.port';
import { TaskCommentMapper } from '../mappers/task-comment.mapper';

@Injectable()
export class TaskCommentRepository
    extends PrismaRepository
    implements TaskCommentRepositoryPort
{
    private readonly mapper = new TaskCommentMapper();

    constructor(db: DatabaseService) {
        super(db);
    }

    async insert(comment: TaskComment): Promise<void> {
        await this.write(comment, (client) =>
            client.taskComment.create({
                data: this.mapper.toPersistence(comment),
            }),
        );
    }

    // spec: tasks/comments#requirement-комментарий-фиксирует-автора-время-и-текст —
    // хронологический порядок (от старого к новому).
    async findByTaskId(taskId: string): Promise<TaskComment[]> {
        const records = await this.client.taskComment.findMany({
            where: { taskId },
            orderBy: { createdAt: 'asc' },
        });
        return records.map((record) => this.mapper.toDomain(record));
    }
}
