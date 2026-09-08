import { Controller, Get, Param } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import type { EmployeeSalaryReportResponse } from 'ireports-contracts';
import { routesV1 } from '@/config/app.routes';
import { ArgumentInvalidException } from '@/shared/exceptions';
import { GetShopEmployeeSalaryReportService } from '@/domains/shop/modules/accounting/application/services/salary-report/get-employee-salary-report.service';

// Отчёт по зарплате сотрудника магазина (Фаза 13.5, issue #57) — зеркало
// GetEmployeeSalaryReportHttpController направления service, но собственный
// путь под /v1/shop (см. routesV1.shop.accounting.salaryReport.employee) и
// собственный сервис GetShopEmployeeSalaryReportService — ответ
// одностороннее направление shop, а не объединённый отчёт по обоим
// направлениям (см. employeeSalaryReportResponseSchema в contracts).
@ApiTags('Бухгалтерия: отчёты магазина')
@Controller()
export class GetShopEmployeeSalaryReportHttpController {
    constructor(
        private readonly getShopEmployeeSalaryReport: GetShopEmployeeSalaryReportService,
    ) {}

    @Get(routesV1.shop.accounting.salaryReport.employee)
    @ApiOperation({
        summary: 'Отчёт по зарплате сотрудника магазина за период',
    })
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

        return this.getShopEmployeeSalaryReport.execute(employeeId, period);
    }
}
