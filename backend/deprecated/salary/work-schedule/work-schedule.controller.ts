import {
  Body,
  Controller,
  Get,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { WorkScheduleService } from './work-schedule.service';
import {
  BulkWorkScheduleDto,
  UpdateWorkShiftDto,
  WorkScheduleQueryDto,
} from './dto/work-schedule.dto';

@Controller()
export class WorkScheduleController {
  constructor(private readonly workSchedule: WorkScheduleService) {}

  @Get('work-schedule')
  findAll(@Query() { employeeId, period }: WorkScheduleQueryDto) {
    return this.workSchedule.findAll(employeeId, period);
  }

  @Post('work-schedule/bulk')
  bulkUpsert(@Body() dto: BulkWorkScheduleDto) {
    return this.workSchedule.bulkUpsert(dto.shifts);
  }

  @Patch('work-shifts/:id')
  update(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateWorkShiftDto,
  ) {
    return this.workSchedule.update(id, dto);
  }
}
