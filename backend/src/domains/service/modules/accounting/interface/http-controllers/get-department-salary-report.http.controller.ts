import { Controller, Get, Param } from '@nestjs/common';
import type { DepartmentSalaryReportResponse } from 'ireports-contracts';
import { ArgumentInvalidException } from '@/shared/exceptions';
import { GetDepartmentSalaryReportService } from '@/domains/service/modules/accounting/application/services/get-department-salary-report.service';

@Controller('accounting')
export class GetDepartmentSalaryReportHttpController {
    constructor(
        private readonly getDepartmentSalaryReport: GetDepartmentSalaryReportService,
    ) {}

    @Get('salary_report/department/:id/:period')
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
