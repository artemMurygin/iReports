import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { RewardsService } from './rewards.service';
import { DatabaseService } from '../../database/database.service';

describe('RewardsService', () => {
  let service: RewardsService;
  const dbBase = {
    reward: { create: jest.fn(), update: jest.fn(), findUnique: jest.fn() },
    rewardProgressionTier: { deleteMany: jest.fn() },
  };
  const db = {
    ...dbBase,
    $transaction: jest.fn((cb: (tx: typeof dbBase) => unknown) => cb(dbBase)),
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      providers: [RewardsService, { provide: DatabaseService, useValue: db }],
    }).compile();
    service = module.get<RewardsService>(RewardsService);
  });

  it('создаёт вознаграждение вместе с тирами прогрессии', async () => {
    db.reward.create.mockResolvedValue({ id: 1 });
    const tiers = [
      {
        fromPct: 0,
        toPct: 70,
        mode: 'FIXED',
        coef: 0.5,
        coefFrom: null,
        coefTo: null,
      },
    ];

    await service.create({
      name: '% маржи',
      type: 'PERCENT',
      value: 1000,
      tiers,
    } as never);

    expect(db.reward.create).toHaveBeenCalledWith({
      data: {
        name: '% маржи',
        type: 'PERCENT',
        value: 1000,
        tiers: { create: tiers },
      },
      include: { tiers: true },
    });
  });

  it('update: 404 для несуществующего вознаграждения', async () => {
    db.reward.findUnique.mockResolvedValue(null);
    await expect(service.update(404, {})).rejects.toThrow(NotFoundException);
  });

  it('update: полностью заменяет тиры, если они переданы (delete + create)', async () => {
    db.reward.findUnique.mockResolvedValue({ id: 1 });
    db.reward.update.mockResolvedValue({ id: 1 });
    const tiers = [
      {
        fromPct: 0,
        toPct: null,
        mode: 'MULTIPLIER',
        coef: 1.2,
        coefFrom: null,
        coefTo: null,
      },
    ];

    await service.update(1, { tiers } as never);

    expect(db.rewardProgressionTier.deleteMany).toHaveBeenCalledWith({
      where: { rewardId: 1 },
    });
    expect(db.reward.update).toHaveBeenCalledWith({
      where: { id: 1 },
      data: { tiers: { create: tiers } },
      include: { tiers: true },
    });
  });

  it('update: не трогает тиры, если они не переданы', async () => {
    db.reward.findUnique.mockResolvedValue({ id: 1 });
    db.reward.update.mockResolvedValue({ id: 1 });

    await service.update(1, { name: 'Новое имя' } as never);

    expect(db.rewardProgressionTier.deleteMany).not.toHaveBeenCalled();
  });
});
