import { Body, Controller, HttpCode, HttpStatus, Post } from '@nestjs/common';
import { CommandBus } from '@nestjs/cqrs';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import type { EmployeeHoursEntryResponse } from 'ireports-contracts';
import { routesV1 } from '@/config/app.routes';
import { EmployeeHoursEntryCreateDto } from '../dto/employee-hours-entry-create.dto';
import { CreateEmployeeHoursEntryCommand } from '../../application/command/create-employee-hours-entry.command';

@ApiTags('Бухгалтерия: часы сотрудников')
@Controller()
export class CreateEmployeeHoursEntryHttpController {
    constructor(private readonly commandBus: CommandBus) {}

    @Post(routesV1.service.accounting.employeeHours)
    @HttpCode(HttpStatus.CREATED)
    @ApiOperation({
        summary: 'Создать запись отработанных часов сотрудника за период',
    })
    async create(
        @Body() body: EmployeeHoursEntryCreateDto,
    ): Promise<EmployeeHoursEntryResponse> {
        const command = new CreateEmployeeHoursEntryCommand(body);
        return this.commandBus.execute(command);
    }
}
