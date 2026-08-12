import { Body, Controller, Param, Patch } from '@nestjs/common';
import { CommandBus } from '@nestjs/cqrs';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import type { EmployeeHoursEntryResponse } from 'ireports-contracts';
import { routesV1 } from '@/config/app.routes';
import { EmployeeHoursEntryUpdateDto } from '../dto/employee-hours-entry-update.dto';
import { UpdateEmployeeHoursEntryCommand } from '../../application/command/update-employee-hours-entry.command';

@ApiTags('Бухгалтерия: часы сотрудников')
@Controller()
export class UpdateEmployeeHoursEntryHttpController {
    constructor(private readonly commandBus: CommandBus) {}

    @Patch(routesV1.service.accounting.employeeHoursById)
    @ApiOperation({ summary: 'Изменить количество отработанных часов' })
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
