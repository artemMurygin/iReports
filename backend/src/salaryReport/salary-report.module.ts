import { Module } from '@nestjs/common';
import { SalaryReportService } from './salary-report.service';
import { SalaryReportController } from './salary-report.controller';

@Module({
  controllers: [SalaryReportController],
  providers: [SalaryReportService],
})
export class SalaryReportModule {}
