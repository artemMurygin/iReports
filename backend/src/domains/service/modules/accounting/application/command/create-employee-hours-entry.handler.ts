import { Inject } from '@nestjs/common';
import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import type { EmployeeHoursEntryResponse } from 'ireports-contracts';
import { CreateEmployeeHoursEntryCommand } from './create-employee-hours-entry.command';
import { EmployeeHoursEntry } from '@/domains/service/modules/accounting/domain/entities/employee-hours-entry.entity';
import { EmployeeHoursEntryAlreadyExistsException } from '@/domains/service/modules/accounting/domain/exceptions/employee-hours-entry.exception';
import { EMPLOYEE_HOURS_ENTRY_REPOSITORY } from '@/domains/service/modules/accounting/application/ports/employee-hours-entry.port';
import type { EmployeeHoursEntryRepositoryPort } from '@/domains/service/modules/accounting/application/ports/employee-hours-entry.port';
import { EnsurePeriodNotClosedService } from '@/domains/service/modules/accounting/application/services/ensure-period-not-closed.service';
import { toEmployeeHoursEntryResponse } from '@/domains/service/modules/accounting/application/mappers/to-employee-hours-entry-response';

@CommandHandler(CreateEmployeeHoursEntryCommand)
export class CreateEmployeeHoursEntryHandler implements ICommandHandler<
    CreateEmployeeHoursEntryCommand,
    EmployeeHoursEntryResponse
> {
    constructor(
        @Inject(EMPLOYEE_HOURS_ENTRY_REPOSITORY)
        private readonly repo: EmployeeHoursEntryRepositoryPort,
        private readonly ensurePeriodNotClosed: EnsurePeriodNotClosedService,
    ) {}

    async execute(
        command: CreateEmployeeHoursEntryCommand,
    ): Promise<EmployeeHoursEntryResponse> {
        // Часы закрытого месяца заблокированы (PRD 1
        // docs/payroll-closing-and-accrual) — 409 с closedBy/closedAt.
        await this.ensurePeriodNotClosed.ensureNotClosed(command.period);

        // Проверка "на чтение" перед вставкой — дружелюбное сообщение;
        // @@unique в salary.prisma остаётся последней линией защиты (тот же
        // приём, что и у CreateSalesPlanHandler).
        const existing = await this.repo.findByEmployeeAndPeriod(
            command.employeeId,
            command.period,
        );
        if (existing) {
            throw new EmployeeHoursEntryAlreadyExistsException(
                `Запись часов сотрудника ${command.employeeId} за ${command.period} уже существует`,
            );
        }

        const entry = EmployeeHoursEntry.create({
            employeeId: command.employeeId,
            period: command.period,
            hours: command.hours,
        });

        await this.repo.insert(entry);

        return toEmployeeHoursEntryResponse(entry);
    }
}
