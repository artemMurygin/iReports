import {
    Controller,
    Delete,
    HttpCode,
    HttpStatus,
    Param,
} from '@nestjs/common';
import { CommandBus } from '@nestjs/cqrs';
import { DeleteEmployeeHoursEntryCommand } from '../../application/command/delete-employee-hours-entry.command';

@Controller('accounting')
export class DeleteEmployeeHoursEntryHttpController {
    constructor(private readonly commandBus: CommandBus) {}

    @Delete('employee_hours/:id')
    @HttpCode(HttpStatus.NO_CONTENT)
    async delete(@Param('id') id: string): Promise<void> {
        const command = new DeleteEmployeeHoursEntryCommand({ entryId: id });
        await this.commandBus.execute(command);
    }
}
