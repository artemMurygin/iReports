import { Controller, Get, Query } from '@nestjs/common';
import { ReportsService } from './reports.service';
import { getServiceFunnelReportDTO } from './dto/getServiceFunnelReport.dto';
import { getServicesSoldReportDTO } from './dto/getServicesSoldReport.dto';

@Controller('reports')
export class ReportsController {
  constructor(private readonly reportsService: ReportsService) {}

  @Get('service-funnel')
  getServiceFunnelReport(@Query() filter: getServiceFunnelReportDTO) {
    return this.reportsService.getServiceFunnelReport(filter);
  }

  @Get('services-sold')
  getServicesSoldReport(@Query() filter: getServicesSoldReportDTO) {
    return this.reportsService.getServicesSoldReport(filter);
  }
}
