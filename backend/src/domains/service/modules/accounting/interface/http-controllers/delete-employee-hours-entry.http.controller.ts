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
import { DeleteEmployeeHoursEntryCommand } from '../../application/command/delete-employee-hours-entry.command';

@ApiTags('Бухгалтерия: часы сотрудников')
@Controller()
export class DeleteEmployeeHoursEntryHttpController {
    constructor(private readonly commandBus: CommandBus) {}

    @Delete(routesV1.service.accounting.employeeHoursById)
    @HttpCode(HttpStatus.NO_CONTENT)
    @ApiOperation({ summary: 'Удалить запись отработанных часов' })
    async delete(@Param('id') id: string): Promise<void> {
        const command = new DeleteEmployeeHoursEntryCommand({ entryId: id });
        await this.commandBus.execute(command);
    }
}
