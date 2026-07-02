import { Body, Controller, Get, Post, Query } from '@nestjs/common';
import { SalaryAdjustmentsService } from './salary-adjustments.service';
import {
  CreateSalaryAdjustmentDto,
  SalaryAdjustmentQueryDto,
} from './dto/salary-adjustment.dto';

@Controller('salary-adjustments')
export class SalaryAdjustmentsController {
  constructor(private readonly adjustments: SalaryAdjustmentsService) {}

  @Post()
  create(@Body() dto: CreateSalaryAdjustmentDto) {
    return this.adjustments.create(dto);
  }

  @Get()
  findAll(@Query() { employeeId, period }: SalaryAdjustmentQueryDto) {
    return this.adjustments.findAll(employeeId, period);
  }
}
