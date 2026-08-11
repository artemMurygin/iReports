import { Body, Controller, HttpCode, HttpStatus, Post } from '@nestjs/common';
import { CommandBus } from '@nestjs/cqrs';
import type { EmployeeHoursEntryResponse } from 'ireports-contracts';
import { EmployeeHoursEntryCreateDto } from '../dto/employee-hours-entry-create.dto';
import { CreateEmployeeHoursEntryCommand } from '../../application/command/create-employee-hours-entry.command';

@Controller('accounting')
export class CreateEmployeeHoursEntryHttpController {
    constructor(private readonly commandBus: CommandBus) {}

    @Post('employee_hours')
    @HttpCode(HttpStatus.CREATED)
    async create(
        @Body() body: EmployeeHoursEntryCreateDto,
    ): Promise<EmployeeHoursEntryResponse> {
        const command = new CreateEmployeeHoursEntryCommand(body);
        return this.commandBus.execute(command);
    }
}
