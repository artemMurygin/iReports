import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import type { MonthlyWorkScheduleResponse } from 'ireports-contracts';
import { routesV1 } from '@/config/app.routes';
import { SessionAuthGuard } from '@/modules/session/interface/session-auth.guard';
import { PermissionsGuard } from '@/modules/roles/interface/permissions.guard';
import { RequirePermissions } from '@/shared/decorators/require-permissions.decorator';
import { GetMonthlyWorkScheduleQueryDto } from '../dto/get-monthly-work-schedule-query.dto';
import { GetMonthlyWorkScheduleService } from '../../application/services/get-monthly-work-schedule.service';

@ApiTags('График работы')
@UseGuards(SessionAuthGuard, PermissionsGuard)
@RequirePermissions('work-schedule:view')
@Controller()
export class GetMonthlyWorkScheduleHttpController {
    constructor(
        private readonly getMonthlyWorkSchedule: GetMonthlyWorkScheduleService,
    ) {}

    @Get(routesV1.workSchedule.month)
    @ApiOperation({
        summary:
            'График работы за месяц: сотрудники × дни, итоги по сотруднику и агрегаты по дням',
    })
    async get(
        @Query() query: GetMonthlyWorkScheduleQueryDto,
    ): Promise<MonthlyWorkScheduleResponse> {
        return this.getMonthlyWorkSchedule.execute(
            query.month,
            query.departmentId,
        );
    }
}
