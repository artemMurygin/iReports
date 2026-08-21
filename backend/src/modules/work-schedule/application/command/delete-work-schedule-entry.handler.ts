import { Inject } from '@nestjs/common';
import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { DeleteWorkScheduleEntryCommand } from './delete-work-schedule-entry.command';
import { WorkScheduleEntryNotFoundException } from '@/modules/work-schedule/domain/exceptions/work-schedule-entry.exception';
import { WORK_SCHEDULE_ENTRY_REPOSITORY } from '@/modules/work-schedule/application/ports/work-schedule-entry.port';
import type { WorkScheduleEntryRepositoryPort } from '@/modules/work-schedule/application/ports/work-schedule-entry.port';
import { EnsurePeriodNotClosedService } from '@/domains/service/modules/accounting/application/services/ensure-period-not-closed.service';

// Удаление — возврат дня в состояние «не заполнен» (PRD, "В скоупе"), а не
// правка статуса: строки без записи графика читаются контекстами расчёта и
// составом смены (Фазы 4-5) как «нет данных», а не как ещё один статус.
@CommandHandler(DeleteWorkScheduleEntryCommand)
export class DeleteWorkScheduleEntryHandler implements ICommandHandler<
    DeleteWorkScheduleEntryCommand,
    void
> {
    constructor(
        @Inject(WORK_SCHEDULE_ENTRY_REPOSITORY)
        private readonly repo: WorkScheduleEntryRepositoryPort,
        private readonly ensurePeriodNotClosed: EnsurePeriodNotClosedService,
    ) {}

    async execute(command: DeleteWorkScheduleEntryCommand): Promise<void> {
        const entry = await this.repo.findById(command.entryId);
        if (!entry) {
            throw new WorkScheduleEntryNotFoundException();
        }

        // Часы закрытого месяца заблокированы (PRD 1
        // docs/payroll-closing-and-accrual) — 409 с closedBy/closedAt.
        await this.ensurePeriodNotClosed.ensureNotClosed(
            entry.date.getValue().slice(0, 7),
        );

        await this.repo.delete(command.entryId);
    }
}
