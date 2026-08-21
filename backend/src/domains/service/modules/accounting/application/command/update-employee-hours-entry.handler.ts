import { Inject } from '@nestjs/common';
import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import type { EmployeeHoursEntryResponse } from 'ireports-contracts';
import { UpdateEmployeeHoursEntryCommand } from './update-employee-hours-entry.command';
import { EmployeeHoursEntryNotFoundException } from '@/domains/service/modules/accounting/domain/exceptions/employee-hours-entry.exception';
import { EMPLOYEE_HOURS_ENTRY_REPOSITORY } from '@/domains/service/modules/accounting/application/ports/employee-hours-entry.port';
import type { EmployeeHoursEntryRepositoryPort } from '@/domains/service/modules/accounting/application/ports/employee-hours-entry.port';
import { EnsurePeriodNotClosedService } from '@/domains/service/modules/accounting/application/services/ensure-period-not-closed.service';
import { toEmployeeHoursEntryResponse } from '@/domains/service/modules/accounting/application/mappers/to-employee-hours-entry-response';

@CommandHandler(UpdateEmployeeHoursEntryCommand)
export class UpdateEmployeeHoursEntryHandler implements ICommandHandler<
    UpdateEmployeeHoursEntryCommand,
    EmployeeHoursEntryResponse
> {
    constructor(
        @Inject(EMPLOYEE_HOURS_ENTRY_REPOSITORY)
        private readonly repo: EmployeeHoursEntryRepositoryPort,
        private readonly ensurePeriodNotClosed: EnsurePeriodNotClosedService,
    ) {}

    async execute(
        command: UpdateEmployeeHoursEntryCommand,
    ): Promise<EmployeeHoursEntryResponse> {
        const entry = await this.repo.findById(command.entryId);
        if (!entry) {
            throw new EmployeeHoursEntryNotFoundException();
        }

        // Часы закрытого месяца заблокированы (PRD 1
        // docs/payroll-closing-and-accrual) — 409 с closedBy/closedAt.
        await this.ensurePeriodNotClosed.ensureNotClosed(entry.period);

        entry.edit(command.hours);
        await this.repo.update(entry);

        return toEmployeeHoursEntryResponse(entry);
    }
}
