import {
    Controller,
    Delete,
    HttpCode,
    HttpStatus,
    Param,
} from '@nestjs/common';
import { CommandBus } from '@nestjs/cqrs';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { routesV1 } from '@/config/app.routes';
import { DeleteWorkScheduleEntryCommand } from '../../application/command/delete-work-schedule-entry.command';

@ApiTags('График работы')
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
