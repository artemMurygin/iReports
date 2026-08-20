import { Module } from '@nestjs/common';
import { CqrsModule } from '@nestjs/cqrs';
import { WORK_SCHEDULE_ENTRY_REPOSITORY } from './application/ports/work-schedule-entry.port';
import { WorkScheduleEntryRepository } from './infrastructure/repositories/work-schedule-entry.repository';
import { UpsertWorkScheduleEntryHandler } from './application/command/upsert-work-schedule-entry.handler';
import { DeleteWorkScheduleEntryHandler } from './application/command/delete-work-schedule-entry.handler';
import { UpsertWorkScheduleEntryHttpController } from './interface/http-controllers/upsert-work-schedule-entry.http.controller';
import { DeleteWorkScheduleEntryHttpController } from './interface/http-controllers/delete-work-schedule-entry.http.controller';

// График работы сотрудников (Фаза 1, docs/employee-work-schedule) — модуль
// намеренно не вложен ни в domains/service, ни в domains/shop: у сущности
// нет дискриминатора direction (человек принадлежит Bitrix-отделу, а не
// направлению), а читать график будут контексты расчёта обоих направлений
// (Фаза 5) — тот же принцип, что у modules/directory и
// modules/employee-identity, поэтому модуль живёт на уровне src/modules.
@Module({
    imports: [CqrsModule],
    controllers: [
        UpsertWorkScheduleEntryHttpController,
        DeleteWorkScheduleEntryHttpController,
    ],
    providers: [
        {
            provide: WORK_SCHEDULE_ENTRY_REPOSITORY,
            useClass: WorkScheduleEntryRepository,
        },
        UpsertWorkScheduleEntryHandler,
        DeleteWorkScheduleEntryHandler,
    ],
    // Экспорт токена репозитория — Фаза 5 подключит его к контекстам
    // расчёта зарплаты (build-service-calculation-context,
    // build-shop-calculation-context) как источник hoursWorked.
    exports: [WORK_SCHEDULE_ENTRY_REPOSITORY],
})
export class WorkScheduleModule {}
