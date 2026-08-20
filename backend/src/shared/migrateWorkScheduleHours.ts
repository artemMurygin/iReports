import 'dotenv/config';
import { NestFactory } from '@nestjs/core';
import { AppModule } from '../app.module';
import { DatabaseService } from '../infrustructure/database/database.service';
import { ScheduleDate } from '../modules/work-schedule/domain/value-objects/schedule-date.value-object';
import { WORKING_STATUS } from '../modules/work-schedule/domain/constants/working-status';
import {
    planWorkScheduleHoursMigration,
    scheduleDateKey,
} from '../modules/work-schedule/infrastructure/migration/plan-work-schedule-hours-migration';

// Оба направления читают одну и ту же (без дискриминатора direction)
// таблицу графика (см. work-schedule.prisma) — кэш расчёта сбрасывается по
// обоим, а не только по тому направлению, в котором исторически
// заводились EmployeeHoursEntry (сущность была направление-агностична).
const DIRECTIONS = ['service', 'shop'] as const;

// Разовый перенос EmployeeHoursEntry → WorkScheduleEntry (Фаза 5,
// docs/employee-work-schedule/plan-employee-work-schedule.md) — запусти
// ПЕРЕД применением миграции `20260820130000_drop_employee_hours_entry`
// (см. её migration.sql), иначе переносить будет уже нечего. Идемпотентен:
// planWorkScheduleHoursMigration пропускает сотрудника/период, для которого
// в графике уже есть хоть одна запись (см. её комментарий) — повторный
// запуск после частичного сбоя безопасен.
//
// Работает напрямую с Prisma-клиентом (db.workScheduleEntry/
// db.accountingPeriod/db.accountingCalculationCache), а не через DI-порты/
// репозитории модулей — тот же приём, что и у migrateEmployeeIdentities.ts
// (см. рядом): разовый скрипт миграции не обязан идти через architecture
// layers, которые существуют ради приложения, а не ради самого себя.
//
// Старую EmployeeHoursEntry читаем СЫРЫМ SQL ($queryRaw), а не
// db.employeeHoursEntry: модель удалена этой же фазой из
// prisma/schema/salary.prisma (см. её комментарий) вместе с генерируемым
// клиентом, поэтому типизированного доступа к ней в клиенте уже нет — но
// сама таблица employee_hours_entries в БД физически ещё существует до
// применения DROP TABLE-миграции 20260820130000_drop_employee_hours_entry
// (см. её migration.sql: "выполни перенос перед применением"), и сырой
// запрос работает по имени таблицы независимо от того, что знает о ней
// текущая Prisma-схема.
interface LegacyEmployeeHoursRow {
    employee_id: number;
    period: string;
    hours: number;
}

async function bootstrap() {
    const app = await NestFactory.createApplicationContext(AppModule);
    const db = app.get(DatabaseService);

    try {
        const legacyRows = await db.$queryRaw<LegacyEmployeeHoursRow[]>`
            SELECT employee_id, period, hours FROM employee_hours_entries
        `;
        const legacyEntries = legacyRows.map((row) => ({
            employeeId: row.employee_id,
            period: row.period,
            hours: row.hours,
        }));
        if (legacyEntries.length === 0) {
            console.log('Переносить нечего — EmployeeHoursEntry пуст.');
            await app.close();
            return;
        }

        const existingScheduleRecords = await db.workScheduleEntry.findMany({
            select: { employeeId: true, date: true },
        });
        const existingScheduleDates = new Set(
            existingScheduleRecords.map((record) =>
                scheduleDateKey(
                    record.employeeId,
                    ScheduleDate.fromDate(record.date).getValue(),
                ),
            ),
        );

        const plan = planWorkScheduleHoursMigration(
            legacyEntries,
            existingScheduleDates,
        );

        if (plan.items.length > 0) {
            await db.workScheduleEntry.createMany({
                data: plan.items.map((item) => ({
                    id: item.id,
                    employeeId: item.employeeId,
                    date: ScheduleDate.create(item.date).toDate(),
                    status: WORKING_STATUS,
                    hours: item.hours,
                })),
            });
            console.log(`Перенесено записей графика: ${plan.items.length}`);
        } else {
            console.log(
                'Новых записей графика не создано (уже перенесено, либо графики за эти периоды уже заполнены вручную).',
            );
        }

        if (plan.skipped.length > 0) {
            console.warn(
                `Пропущено записей (требуется ручная проверка): ${plan.skipped.length}`,
            );
            for (const skip of plan.skipped) {
                console.warn(
                    `  employeeId=${skip.employeeId} period=${skip.period}: ${skip.reason}`,
                );
            }
        }

        // Сброс кэша расчёта затронутых периодов — только у ОТКРЫТЫХ
        // (закрытые защищены неизменяемым снапшотом и не пересчитываются,
        // см. PRD "Технические ограничения": "Закрытые периоды защищены
        // снапшотом и не пересчитываются"). AccountingPeriod/
        // AccountingCalculationCache — общие таблицы на оба направления
        // (direction — колонка, не отдельная модель), поэтому проверяем и
        // чистим обе.
        const migratedPeriods = [
            ...new Set(legacyEntries.map((entry) => entry.period)),
        ];
        for (const period of migratedPeriods) {
            for (const direction of DIRECTIONS) {
                const periodRecord = await db.accountingPeriod.findUnique({
                    where: { direction_period: { direction, period } },
                    select: { status: true },
                });
                if (periodRecord?.status === 'CLOSED') {
                    continue;
                }
                await db.accountingCalculationCache.deleteMany({
                    where: { direction, period },
                });
            }
        }
        console.log(
            `Кэш расчёта сброшен для периодов: ${migratedPeriods.join(', ')}`,
        );

        await app.close();
    } catch (error) {
        console.error(error);
        process.exit(1);
    }
}

void bootstrap();
