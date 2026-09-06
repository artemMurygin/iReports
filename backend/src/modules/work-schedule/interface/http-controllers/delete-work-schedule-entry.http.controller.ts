import {
    Controller,
    Delete,
    HttpCode,
    HttpStatus,
    Param,
    UseGuards,
} from '@nestjs/common';
import { CommandBus } from '@nestjs/cqrs';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { routesV1 } from '@/config/app.routes';
import { SessionAuthGuard } from '@/modules/session/interface/session-auth.guard';
import { CsrfGuard } from '@/modules/session/interface/csrf.guard';
import { PermissionsGuard } from '@/modules/roles/interface/permissions.guard';
import { RequirePermissions } from '@/shared/decorators/require-permissions.decorator';
import { DeleteWorkScheduleEntryCommand } from '../../application/command/delete-work-schedule-entry.command';

@ApiTags('График работы')
@UseGuards(SessionAuthGuard, CsrfGuard, PermissionsGuard)
@RequirePermissions('work-schedule:manage')
@Controller()
export class DeleteWorkScheduleEntryHttpController {
    constructor(private readonly commandBus: CommandBus) {}

    @Delete(routesV1.workSchedule.entryById)
    @HttpCode(HttpStatus.NO_CONTENT)
    @ApiOperation({
        summary:
            'Удалить запись графика на день (вернуть день в «не заполнен»)',
    })
    async delete(@Param('id') id: string): Promise<void> {
        const command = new DeleteWorkScheduleEntryCommand({ entryId: id });
        await this.commandBus.execute(command);
    }
}
