import { Controller, Get, Param } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import type { DepartmentSalaryReportResponse } from 'ireports-contracts';
import { routesV1 } from '@/config/app.routes';
import { ArgumentInvalidException } from '@/shared/exceptions';
import { GetShopDepartmentSalaryReportService } from '@/domains/shop/modules/accounting/application/services/get-shop-department-salary-report.service';

// Отчёт по зарплатам отдела, ограниченный ОДНИМ направлением shop — зеркало
// GetDepartmentSalaryReportHttpController направления service, но
// собственный путь под /v1/shop (см.
// routesV1.shop.accounting.salaryReport.department) и собственный сервис
// GetShopDepartmentSalaryReportService: в отличие от объединённого
// .../accounting/salary_report/department/:id/:period сервиса
// (GetDepartmentSalaryReportService, сводит service и shop в один ответ с
// комбинированным isClosed), здесь isClosed — статус закрытия периода
// направления shop как есть, без combine-шага по двум направлениям.
@ApiTags('Бухгалтерия: отчёты магазина')
@Controller()
export class GetShopDepartmentSalaryReportHttpController {
    constructor(
        private readonly getShopDepartmentSalaryReport: GetShopDepartmentSalaryReportService,
    ) {}

    @Get(routesV1.shop.accounting.salaryReport.department)
    @ApiOperation({ summary: 'Отчёт по зарплатам отдела магазина за период' })
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

        return this.getShopDepartmentSalaryReport.execute(departmentId, period);
    }
}
