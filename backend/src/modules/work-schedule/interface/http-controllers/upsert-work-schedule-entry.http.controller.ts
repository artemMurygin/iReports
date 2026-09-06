import { Body, Controller, Put, UseGuards } from '@nestjs/common';
import { CommandBus } from '@nestjs/cqrs';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import type { WorkScheduleEntryResponse } from 'ireports-contracts';
import { routesV1 } from '@/config/app.routes';
import { SessionAuthGuard } from '@/modules/session/interface/session-auth.guard';
import { CsrfGuard } from '@/modules/session/interface/csrf.guard';
import { PermissionsGuard } from '@/modules/roles/interface/permissions.guard';
import { RequirePermissions } from '@/shared/decorators/require-permissions.decorator';
import { UpsertWorkScheduleEntryDto } from '../dto/upsert-work-schedule-entry.dto';
import { UpsertWorkScheduleEntryCommand } from '../../application/command/upsert-work-schedule-entry.command';

@ApiTags('График работы')
@UseGuards(SessionAuthGuard, CsrfGuard, PermissionsGuard)
@RequirePermissions('work-schedule:manage')
@Controller()
export class UpsertWorkScheduleEntryHttpController {
    constructor(private readonly commandBus: CommandBus) {}

    // PUT, а не POST/PATCH — идемпотентный upsert по естественному ключу
    // (employeeId, date), см. комментарий над upsertWorkScheduleEntryRequestSchema
    // в contracts/commands/work-schedule.ts.
    @Put(routesV1.workSchedule.entries)
    @ApiOperation({
        summary:
            'Создать или изменить запись графика на день (статус, часы, роль)',
    })
    async upsert(
        @Body() body: UpsertWorkScheduleEntryDto,
    ): Promise<WorkScheduleEntryResponse> {
        const command = new UpsertWorkScheduleEntryCommand(body);
        return this.commandBus.execute(command);
    }
}
