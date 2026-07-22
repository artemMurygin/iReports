import { Injectable } from '@nestjs/common';
import { DatabaseService } from '../../database/database.service';
import { CreateSalaryAdjustmentDto } from './dto/salary-adjustment.dto';

@Injectable()
export class SalaryAdjustmentsService {
  constructor(private readonly db: DatabaseService) {}

  create(dto: CreateSalaryAdjustmentDto) {
    return this.db.salaryAdjustment.create({ data: dto });
  }

  findAll(employeeId: number, period: string) {
    return this.db.salaryAdjustment.findMany({
      where: { employeeId, period },
      orderBy: { createdAt: 'desc' },
    });
  }
}
