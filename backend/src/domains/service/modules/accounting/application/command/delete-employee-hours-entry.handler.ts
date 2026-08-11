import { Inject } from '@nestjs/common';
import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { DeleteEmployeeHoursEntryCommand } from './delete-employee-hours-entry.command';
import { EmployeeHoursEntryNotFoundException } from '@/domains/service/modules/accounting/domain/exceptions/employee-hours-entry.exception';
import { EMPLOYEE_HOURS_ENTRY_REPOSITORY } from '@/domains/service/modules/accounting/application/ports/employee-hours-entry.port';
import type { EmployeeHoursEntryRepositoryPort } from '@/domains/service/modules/accounting/application/ports/employee-hours-entry.port';

@CommandHandler(DeleteEmployeeHoursEntryCommand)
export class DeleteEmployeeHoursEntryHandler implements ICommandHandler<
    DeleteEmployeeHoursEntryCommand,
    void
> {
    constructor(
        @Inject(EMPLOYEE_HOURS_ENTRY_REPOSITORY)
        private readonly repo: EmployeeHoursEntryRepositoryPort,
    ) {}

    async execute(command: DeleteEmployeeHoursEntryCommand): Promise<void> {
        const entry = await this.repo.findById(command.entryId);
        if (!entry) {
            throw new EmployeeHoursEntryNotFoundException();
        }

        await this.repo.delete(command.entryId);
    }
}
