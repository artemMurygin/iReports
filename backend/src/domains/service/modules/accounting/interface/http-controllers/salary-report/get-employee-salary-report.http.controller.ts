import { Controller, Get, Param, UseGuards } from '@nestjs/common';
import { SessionAuthGuard } from '@/modules/session/interface/session-auth.guard';
import { CsrfGuard } from '@/modules/session/interface/csrf.guard';
import { PermissionsGuard } from '@/modules/roles/interface/permissions.guard';
import { RequirePermissions } from '@/shared/decorators/require-permissions.decorator';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import type { EmployeeSalaryReportResponse } from 'ireports-contracts';
import { routesV1 } from '@/config/app.routes';
import { ArgumentInvalidException } from '@/shared/exceptions';
import { GetEmployeeSalaryReportService } from '@/domains/service/modules/accounting/application/services/salary-report/get-employee-salary-report.service';

@ApiTags('Бухгалтерия: отчёты')
@UseGuards(SessionAuthGuard, CsrfGuard, PermissionsGuard)
@RequirePermissions('service-accounting:view_all_salary_report')
@Controller()
export class GetEmployeeSalaryReportHttpController {
    constructor(
        private readonly getEmployeeSalaryReport: GetEmployeeSalaryReportService,
    ) {}

    @Get(routesV1.service.accounting.salaryReport.employee)
    @ApiOperation({ summary: 'Отчёт по зарплате сотрудника за период' })
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
