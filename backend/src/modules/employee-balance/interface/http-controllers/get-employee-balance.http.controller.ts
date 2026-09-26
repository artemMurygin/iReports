import {
    Controller,
    Get,
    Param,
    ParseIntPipe,
    Query,
    UseGuards,
} from '@nestjs/common';
import { SessionAuthGuard } from '@/modules/session/interface/session-auth.guard';
import { CsrfGuard } from '@/modules/session/interface/csrf.guard';
import { PermissionsGuard } from '@/modules/roles/interface/permissions.guard';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import type { EmployeeBalanceResponse } from 'ireports-contracts';
import { routesV1 } from '@/config/app.routes';
import { GetEmployeeBalanceService } from '@/modules/employee-balance/application/services/get-employee-balance.service';
import { GetEmployeeBalanceQueryDto } from '../dto/get-employee-balance-query.dto';
import { EmployeeBalanceOwnershipGuard } from '../guards/employee-balance-ownership.guard';

// Без @RequirePermissions('employee-balance:view_all') — PermissionsGuard
// требует ВСЕХ перечисленных прав (AND), что исключило бы доступ по
// `employee-balance:view_own` к собственному балансу. Реальная проверка
// (view_all ИЛИ view_own+свой id) — в EmployeeBalanceOwnershipGuard ниже;
// PermissionsGuard здесь лишь требует валидную сессию (роут без
// @RequirePermissions открыт любому аутентифицированному).
@ApiTags('Бухгалтерия: баланс сотрудника')
@UseGuards(
    SessionAuthGuard,
    CsrfGuard,
    PermissionsGuard,
    EmployeeBalanceOwnershipGuard,
)
@Controller()
export class GetEmployeeBalanceHttpController {
    constructor(
        private readonly getEmployeeBalance: GetEmployeeBalanceService,
    ) {}

    @Get(routesV1.accounting.balance.employee)
    @ApiOperation({
        summary:
            'Общий баланс сотрудника: остаток (SUM всей ленты по employeeId, без деления на направления), страница движений с фильтрами (курсорная пагинация, по умолчанию 20 последних «за всё время») и selectionTotal — сумма ВСЕЙ отфильтрованной выборки',
    })
    async get(
        @Param('id', ParseIntPipe) id: number,
        @Query() query: GetEmployeeBalanceQueryDto,
    ): Promise<EmployeeBalanceResponse> {
        // Даты в query — ISO-строки (см. getEmployeeBalanceQuerySchema:
        // z.coerce.date() ломает генерацию OpenAPI), в фильтр порта — Date.
        // cursor/limit (Фаза 7) — пробрасываются как есть; дефолт лимита —
        // ответственность репозитория (DEFAULT_BALANCE_TRANSACTIONS_PAGE_LIMIT
        // в balance-transaction.port.ts), не этого контроллера.
        return this.getEmployeeBalance.execute(id, {
            from: query.from ? new Date(query.from) : undefined,
            to: query.to ? new Date(query.to) : undefined,
            types: query.types,
            cursor: query.cursor,
            limit: query.limit,
        });
    }
}
