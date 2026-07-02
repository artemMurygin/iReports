import { Injectable, NotFoundException } from '@nestjs/common';
import { DatabaseService } from '../../database/database.service';
import { parsePeriod } from '../calculation/period';
import {
  BulkWorkScheduleDto,
  UpdateWorkShiftDto,
} from './dto/work-schedule.dto';

@Injectable()
export class WorkScheduleService {
  constructor(private readonly db: DatabaseService) {}

  findAll(employeeId: number, period: string) {
    const { start, endExclusive } = parsePeriod(period);
    return this.db.workShift.findMany({
      where: { employeeId, date: { gte: start, lt: endExclusive } },
      orderBy: { date: 'asc' },
    });
  }

  // Массовое создание/правка смен — upsert по (employeeId, date), в одной транзакции.
  bulkUpsert(shifts: BulkWorkScheduleDto['shifts']) {
    return this.db.$transaction(
      shifts.map((shift) =>
        this.db.workShift.upsert({
          where: {
            employeeId_date: { employeeId: shift.employeeId, date: shift.date },
          },
          create: shift,
          update: shift,
        }),
      ),
    );
  }

  async update(id: number, dto: UpdateWorkShiftDto) {
    const existing = await this.db.workShift.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException(`WorkShift#${id} не найдена`);
    return this.db.workShift.update({ where: { id }, data: dto });
  }
}
