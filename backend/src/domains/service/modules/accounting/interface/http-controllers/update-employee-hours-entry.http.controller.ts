import { Body, Controller, Param, Patch } from '@nestjs/common';
import { CommandBus } from '@nestjs/cqrs';
import type { EmployeeHoursEntryResponse } from 'ireports-contracts';
import { EmployeeHoursEntryUpdateDto } from '../dto/employee-hours-entry-update.dto';
import { UpdateEmployeeHoursEntryCommand } from '../../application/command/update-employee-hours-entry.command';

@Controller('accounting')
export class UpdateEmployeeHoursEntryHttpController {
    constructor(private readonly commandBus: CommandBus) {}

    @Patch('employee_hours/:id')
    async update(
        @Param('id') id: string,
        @Body() body: EmployeeHoursEntryUpdateDto,
    ): Promise<EmployeeHoursEntryResponse> {
        const command = new UpdateEmployeeHoursEntryCommand({
            entryId: id,
            hours: body.hours,
        });
        return this.commandBus.execute(command);
    }
}
