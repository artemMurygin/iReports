import { Injectable, NotFoundException } from '@nestjs/common';
import { DatabaseService } from '../../database/database.service';
import {
  CreateTaskCompletionDto,
  UpdateTaskCompletionDto,
} from './dto/task-completion.dto';

@Injectable()
export class TaskCompletionsService {
  constructor(private readonly db: DatabaseService) {}

  create(dto: CreateTaskCompletionDto) {
    return this.db.taskCompletion.create({ data: dto });
  }

  async update(id: number, dto: UpdateTaskCompletionDto) {
    const existing = await this.db.taskCompletion.findUnique({ where: { id } });
    if (!existing)
      throw new NotFoundException(`TaskCompletion#${id} не найдена`);
    return this.db.taskCompletion.update({
      where: { id },
      data: {
        completed: dto.completed,
        completedAt: dto.completed ? new Date() : null,
        approvedById: dto.approvedById ?? existing.approvedById,
      },
    });
  }
}
