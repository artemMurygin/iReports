import { Controller, Get, Query } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import type { WorkScheduleShiftResponse } from 'ireports-contracts';
import { routesV1 } from '@/config/app.routes';
import { GetWorkScheduleShiftQueryDto } from '../dto/get-work-schedule-shift-query.dto';
import { GetWorkScheduleShiftService } from '../../application/services/get-work-schedule-shift.service';

@ApiTags('График работы')
@Controller()
export class GetWorkScheduleShiftHttpController {
    constructor(
        private readonly getWorkScheduleShift: GetWorkScheduleShiftService,
    ) {}

    @Get(routesV1.workSchedule.shift)
    @ApiOperation({
        summary:
            'Состав смены на дату: кто на смене (роль, часы), кто нет (причина), счётчики ролей',
    })
    async get(
        @Query() query: GetWorkScheduleShiftQueryDto,
    ): Promise<WorkScheduleShiftResponse> {
        return this.getWorkScheduleShift.execute(
            query.date,
            query.departmentId,
        );
    }
}
