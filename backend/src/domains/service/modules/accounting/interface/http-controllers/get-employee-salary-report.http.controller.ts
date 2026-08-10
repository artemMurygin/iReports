import { Controller, Get, Param } from '@nestjs/common';
import type { EmployeeSalaryReportResponse } from 'ireports-contracts';
import { ArgumentInvalidException } from '@/shared/exceptions';
import { GetEmployeeSalaryReportService } from '@/domains/service/modules/accounting/application/services/get-employee-salary-report.service';

@Controller('accounting')
export class GetEmployeeSalaryReportHttpController {
    constructor(
        private readonly getEmployeeSalaryReport: GetEmployeeSalaryReportService,
    ) {}

    @Get('salary_report/employee/:id/:period')
    async get(
        @Param('id') id: string,
        @Param('period') period: string,
    ): Promise<EmployeeSalaryReportResponse> {
        const employeeId = Number(id);
        if (!Number.isInteger(employeeId)) {
            throw new ArgumentInvalidException(
                `id сотрудника должен быть числом, получено: "${id}"`,
            );
        }

        return this.getEmployeeSalaryReport.execute(employeeId, period);
    }
}
