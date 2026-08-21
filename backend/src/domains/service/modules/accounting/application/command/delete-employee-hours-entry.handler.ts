import { Inject } from '@nestjs/common';
import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { DeleteEmployeeHoursEntryCommand } from './delete-employee-hours-entry.command';
import { EmployeeHoursEntryNotFoundException } from '@/domains/service/modules/accounting/domain/exceptions/employee-hours-entry.exception';
import { EMPLOYEE_HOURS_ENTRY_REPOSITORY } from '@/domains/service/modules/accounting/application/ports/employee-hours-entry.port';
import { EnsurePeriodNotClosedService } from '@/domains/service/modules/accounting/application/services/ensure-period-not-closed.service';
import type { EmployeeHoursEntryRepositoryPort } from '@/domains/service/modules/accounting/application/ports/employee-hours-entry.port';

@CommandHandler(DeleteEmployeeHoursEntryCommand)
export class DeleteEmployeeHoursEntryHandler implements ICommandHandler<
    DeleteEmployeeHoursEntryCommand,
    void
> {
    constructor(
        @Inject(EMPLOYEE_HOURS_ENTRY_REPOSITORY)
        private readonly repo: EmployeeHoursEntryRepositoryPort,
        private readonly ensurePeriodNotClosed: EnsurePeriodNotClosedService,
    ) {}

    async execute(command: DeleteEmployeeHoursEntryCommand): Promise<void> {
        const entry = await this.repo.findById(command.entryId);
        if (!entry) {
            throw new EmployeeHoursEntryNotFoundException();
        }

        // Часы закрытого месяца заблокированы (PRD 1
        // docs/payroll-closing-and-accrual) — 409 с closedBy/closedAt.
        await this.ensurePeriodNotClosed.ensureNotClosed(entry.period);

        await this.repo.delete(command.entryId);
    }
}
