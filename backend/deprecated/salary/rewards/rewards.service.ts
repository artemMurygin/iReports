import { Injectable, NotFoundException } from '@nestjs/common';
import { DatabaseService } from '../../database/database.service';
import { CreateRewardDto, UpdateRewardDto } from './dto/reward.dto';

@Injectable()
export class RewardsService {
  constructor(private readonly db: DatabaseService) {}

  create(dto: CreateRewardDto) {
    const { tiers, ...reward } = dto;
    return this.db.reward.create({
      data: { ...reward, tiers: { create: tiers } },
      include: { tiers: true },
    });
  }

  async update(id: number, dto: UpdateRewardDto) {
    const existing = await this.db.reward.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException(`Reward#${id} не найден`);

    const { tiers, ...reward } = dto;
    return this.db.$transaction(async (tx) => {
      if (tiers) {
        await tx.rewardProgressionTier.deleteMany({ where: { rewardId: id } });
      }
      return tx.reward.update({
        where: { id },
        data: { ...reward, ...(tiers ? { tiers: { create: tiers } } : {}) },
        include: { tiers: true },
      });
    });
  }
}
