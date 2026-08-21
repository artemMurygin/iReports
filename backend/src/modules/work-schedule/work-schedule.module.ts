import { Module } from '@nestjs/common';
import { CqrsModule } from '@nestjs/cqrs';
import { DirectoryModule } from '@/modules/directory/directory.module';
import { ACCOUNTING_PERIOD_REPOSITORY } from '@/domains/service/modules/accounting/application/ports/accounting-period.port';
import { AccountingPeriodRepository } from '@/domains/service/modules/accounting/infrastructure/repositories/accounting-period.repository';
import { EnsurePeriodNotClosedService } from '@/domains/service/modules/accounting/application/services/ensure-period-not-closed.service';
import { WORK_SCHEDULE_ENTRY_REPOSITORY } from './application/ports/work-schedule-entry.port';
import { WorkScheduleEntryRepository } from './infrastructure/repositories/work-schedule-entry.repository';
import { UpsertWorkScheduleEntryHandler } from './application/command/upsert-work-schedule-entry.handler';
import { DeleteWorkScheduleEntryHandler } from './application/command/delete-work-schedule-entry.handler';
import { GetMonthlyWorkScheduleService } from './application/services/get-monthly-work-schedule.service';
import { GetWorkScheduleShiftService } from './application/services/get-work-schedule-shift.service';
import { UpsertWorkScheduleEntryHttpController } from './interface/http-controllers/upsert-work-schedule-entry.http.controller';
import { DeleteWorkScheduleEntryHttpController } from './interface/http-controllers/delete-work-schedule-entry.http.controller';
import { GetMonthlyWorkScheduleHttpController } from './interface/http-controllers/get-monthly-work-schedule.http.controller';
import { GetWorkScheduleShiftHttpController } from './interface/http-controllers/get-work-schedule-shift.http.controller';

// График работы сотрудников (Фаза 1, docs/employee-work-schedule) — модуль
// намеренно не вложен ни в domains/service, ни в domains/shop: у сущности
// нет дискриминатора direction (человек принадлежит Bitrix-отделу, а не
// направлению), а читать график будут контексты расчёта обоих направлений
// (Фаза 5) — тот же принцип, что у modules/directory и
// modules/employee-identity, поэтому модуль живёт на уровне src/modules.
//
// DirectoryModule импортирован ради DIRECTORY_REPOSITORY — GetMonthlyWork-
// ScheduleService (Фаза 3) и GetWorkScheduleShiftService (Фаза 4) резолвят
// список сотрудников отдела через тот же справочник Bitrix, что и
// AccountingModule (см. комментарий над exports в DirectoryModule).
@Module({
    imports: [CqrsModule, DirectoryModule],
    controllers: [
        UpsertWorkScheduleEntryHttpController,
        DeleteWorkScheduleEntryHttpController,
        GetMonthlyWorkScheduleHttpController,
        GetWorkScheduleShiftHttpController,
    ],
    providers: [
        {
            provide: WORK_SCHEDULE_ENTRY_REPOSITORY,
            useClass: WorkScheduleEntryRepository,
        },
        // Блокировка записи графика за закрытый месяц (PRD 1
        // docs/payroll-closing-and-accrual, Фаза 2 — там же и обещание, что график
        // подключит этот сервис, а не задублирует проверку). Свой экземпляр
        // ACCOUNTING_PERIOD_REPOSITORY под тем же токеном, что и в AccountingModule/
        // ShopAccountingModule — тот же приём (см. domains/shop/CLAUDE.md), а не
        // импорт всего AccountingModule сервиса ради одного токена.
        {
            provide: ACCOUNTING_PERIOD_REPOSITORY,
            useClass: AccountingPeriodRepository,
        },
        EnsurePeriodNotClosedService,
        UpsertWorkScheduleEntryHandler,
        DeleteWorkScheduleEntryHandler,
        GetMonthlyWorkScheduleService,
        GetWorkScheduleShiftService,
    ],
    // Экспорт токена репозитория — Фаза 5 подключит его к контекстам
    // расчёта зарплаты (build-service-calculation-context,
    // build-shop-calculation-context) как источник hoursWorked.
    exports: [WORK_SCHEDULE_ENTRY_REPOSITORY],
})
export class WorkScheduleModule {}
