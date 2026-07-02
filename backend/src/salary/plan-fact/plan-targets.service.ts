import { Injectable, NotFoundException } from '@nestjs/common';
import { DatabaseService } from '../../database/database.service';
import { BulkCreatePlanTargetsDto, UpdatePlanTargetDto } from './dto/plan-fact.dto';

@Injectable()
export class PlanTargetsService {
  constructor(private readonly db: DatabaseService) {}

  bulkCreate(items: BulkCreatePlanTargetsDto['items']) {
    return this.db.planTarget.createMany({ data: items, skipDuplicates: true });
  }

  async update(id: number, dto: UpdatePlanTargetDto) {
    const existing = await this.db.planTarget.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException(`PlanTarget#${id} не найден`);
    return this.db.planTarget.update({ where: { id }, data: dto });
  }

  async delete(id: number) {
    const existing = await this.db.planTarget.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException(`PlanTarget#${id} не найден`);
    return this.db.planTarget.delete({ where: { id } });
  }
}
