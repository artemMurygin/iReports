import { Controller, Get, Param } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import type { DepartmentSalaryReportResponse } from 'ireports-contracts';
import { routesV1 } from '@/config/app.routes';
import { ArgumentInvalidException } from '@/shared/exceptions';
import { GetDepartmentSalaryReportService } from '@/domains/service/modules/accounting/application/services/get-department-salary-report.service';

@ApiTags('Бухгалтерия: отчёты')
@Controller()
export class GetDepartmentSalaryReportHttpController {
    constructor(
        private readonly getDepartmentSalaryReport: GetDepartmentSalaryReportService,
    ) {}

    @Get(routesV1.service.accounting.salaryReport.department)
    @ApiOperation({ summary: 'Отчёт по зарплатам отдела за период' })
    async get(
        @Param('id') id: string,
        @Param('period') period: string,
    ): Promise<DepartmentSalaryReportResponse> {
        const departmentId = Number(id);
        if (!Number.isInteger(departmentId)) {
            throw new ArgumentInvalidException(
                `id отдела должен быть числом, получено: "${id}"`,
            );
        }

        return this.getDepartmentSalaryReport.execute(departmentId, period);
    }
}
