import { Body, Controller, Get, Post, Query } from '@nestjs/common';
import { SalaryCalculationService } from '../calculation/salary-calculation.service';
import { SalaryReportParamsDto } from './dto/salary-report.dto';

@Controller('salaryReport')
export class SalaryReportController {
  constructor(private readonly calculation: SalaryCalculationService) {}

  @Get()
  getReport(@Query() { employeeId, period }: SalaryReportParamsDto) {
    return this.calculation.getReport(employeeId, period);
  }

  @Post('close')
  closeReport(@Body() { employeeId, period }: SalaryReportParamsDto) {
    return this.calculation.closeReport(employeeId, period);
  }
}
