import { Inject } from '@nestjs/common';
import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import type { WorkScheduleEntryResponse } from 'ireports-contracts';
import { UpsertWorkScheduleEntryCommand } from './upsert-work-schedule-entry.command';
import { WorkScheduleEntry } from '@/modules/work-schedule/domain/entities/work-schedule-entry.entity';
import { ScheduleDate } from '@/modules/work-schedule/domain/value-objects/schedule-date.value-object';
import { WorkDay } from '@/modules/work-schedule/domain/value-objects/work-day.value-object';
import { WORK_SCHEDULE_ENTRY_REPOSITORY } from '@/modules/work-schedule/application/ports/work-schedule-entry.port';
import type { WorkScheduleEntryRepositoryPort } from '@/modules/work-schedule/application/ports/work-schedule-entry.port';
import { toWorkScheduleEntryResponse } from '@/modules/work-schedule/application/mappers/to-work-schedule-entry-response';
import { EnsurePeriodNotClosedService } from '@/domains/service/modules/accounting/application/services/ensure-period-not-closed.service';

// PUT — upsert по естественному ключу (employeeId, date), тем же приёмом,
// что и PutSalesPlanTemplateHandler (domains/service/modules/sales): первое
// заполнение ячейки таблицы создаёт запись, повторный клик по той же ячейке
// правит уже существующую, а не конфликтует с ней (см. PRD, "Критерии
// готовности" — "повторный upsert... меняет запись, а не создаёт вторую").
@CommandHandler(UpsertWorkScheduleEntryCommand)
export class UpsertWorkScheduleEntryHandler implements ICommandHandler<
    UpsertWorkScheduleEntryCommand,
    WorkScheduleEntryResponse
> {
    constructor(
        @Inject(WORK_SCHEDULE_ENTRY_REPOSITORY)
        private readonly repo: WorkScheduleEntryRepositoryPort,
        private readonly ensurePeriodNotClosed: EnsurePeriodNotClosedService,
    ) {}

    async execute(
        command: UpsertWorkScheduleEntryCommand,
    ): Promise<WorkScheduleEntryResponse> {
        // Часы закрытого месяца заблокированы (PRD 1
        // docs/payroll-closing-and-accrual) — 409 с closedBy/closedAt. Период —
        // первые 7 символов даты дня (YYYY-MM), тот же формат, что и у
        // Period.value-object.
        await this.ensurePeriodNotClosed.ensureNotClosed(
            command.date.slice(0, 7),
        );

        // Инвариант «hours/role только у WORKING» проверяет WorkDay.create —
        // ArgumentInvalidException → 400 через DomainExceptionFilter, здесь
        // он не дублируется (см. комментарий в contracts/commands/work-schedule.ts).
        const day = WorkDay.create({
            status: command.status,
            hours: command.hours,
            role: command.role,
        });

        const existing = await this.repo.findByEmployeeAndDate(
            command.employeeId,
            command.date,
        );

        if (existing) {
            existing.edit(day);
            await this.repo.update(existing);
            return toWorkScheduleEntryResponse(existing);
        }

        const entry = WorkScheduleEntry.create({
            employeeId: command.employeeId,
            date: ScheduleDate.create(command.date),
            day,
        });
        await this.repo.insert(entry);

        return toWorkScheduleEntryResponse(entry);
    }
}
