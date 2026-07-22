import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { WorkScheduleService } from './work-schedule.service';
import { DatabaseService } from '../../database/database.service';

describe('WorkScheduleService', () => {
  let service: WorkScheduleService;
  const db = {
    workShift: {
      findMany: jest.fn(),
      upsert: jest.fn(),
      findUnique: jest.fn(),
      update: jest.fn(),
    },
    $transaction: jest.fn((ops: unknown[]) => Promise.all(ops)),
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        WorkScheduleService,
        { provide: DatabaseService, useValue: db },
      ],
    }).compile();
    service = module.get<WorkScheduleService>(WorkScheduleService);
  });

  it('findAll фильтрует смены по границам периода', async () => {
    db.workShift.findMany.mockResolvedValue([]);
    await service.findAll(5, '2026-06');

    expect(db.workShift.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          employeeId: 5,
          date: {
            gte: new Date(Date.UTC(2026, 5, 1)),
            lt: new Date(Date.UTC(2026, 6, 1)),
          },
        },
      }),
    );
  });

  it('bulkUpsert делает upsert по (employeeId, date) для каждой смены одной транзакцией', async () => {
    db.workShift.upsert.mockResolvedValue({ id: 1 });
    const shifts = [
      {
        employeeId: 5,
        date: new Date('2026-06-01'),
        plannedHours: 8,
        status: 'planned',
      },
      {
        employeeId: 5,
        date: new Date('2026-06-02'),
        plannedHours: 8,
        status: 'planned',
      },
    ] as never;

    await service.bulkUpsert(shifts);

    expect(db.workShift.upsert).toHaveBeenCalledTimes(2);
    expect(db.$transaction).toHaveBeenCalled();
  });

  it('update бросает NotFoundException для несуществующей смены', async () => {
    db.workShift.findUnique.mockResolvedValue(null);
    await expect(service.update(404, {})).rejects.toThrow(NotFoundException);
  });
});
