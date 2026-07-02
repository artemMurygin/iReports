import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { DatabaseService } from '../../database/database.service';
import { Direction } from '../../../prisma/generated/prisma/schema/client';
import { castCategoryExtId } from '../calculation/metrics/category-cast';
import { CreateGoalDto, UpdateGoalDto } from './dto/goal.dto';

const includeReward = { reward: { include: { tiers: true } } };

@Injectable()
export class GoalsService {
  constructor(private readonly db: DatabaseService) {}

  async create(dto: CreateGoalDto) {
    if (dto.categoryExtId) {
      await this.validateCategory(dto.direction, dto.categoryExtId);
    }
    return this.db.goal.create({ data: dto, include: includeReward });
  }

  async remove(id: number) {
    const goal = await this.ensureExists(id);
    await this.db.goal.delete({ where: { id } });
    await this.db.reward.delete({ where: { id: goal.rewardId } });
  }

  async update(id: number, dto: UpdateGoalDto) {
    const goal = await this.ensureExists(id);
    if (dto.categoryExtId) {
      await this.validateCategory(goal.direction, dto.categoryExtId);
    }
    return this.db.goal.update({
      where: { id },
      data: dto,
      include: includeReward,
    });
  }

  // Категория существует без локального справочника — проверяем прямо в источнике
  // при сохранении правила (ARCHITECTURE.md §2.2/§7.3), FK на источник не ставим.
  private async validateCategory(direction: Direction, categoryExtId: string) {
    let castId: number | string;
    try {
      castId = castCategoryExtId(direction, categoryExtId);
    } catch (error) {
      throw new BadRequestException((error as Error).message);
    }

    const exists =
      direction === Direction.SERVICE
        ? await this.db.roappServiceCategory.findUnique({
            where: { id: castId as number },
          })
        : await this.db.moySkladProductFolder.findUnique({
            where: { id: castId as string },
          });

    if (!exists) {
      throw new BadRequestException(
        `Категория "${categoryExtId}" не найдена для направления ${direction}`,
      );
    }
  }

  private async ensureExists(id: number) {
    const goal = await this.db.goal.findUnique({ where: { id } });
    if (!goal) throw new NotFoundException(`Goal#${id} не найдена`);
    return goal;
  }
}
