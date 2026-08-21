-- DropTable
-- Ручной ввод часов (EmployeeHoursEntry) заменён графиком работы
-- (WorkScheduleEntry, см. work-schedule.prisma) — Фаза 5,
-- docs/employee-work-schedule/plan-employee-work-schedule.md. Перед
-- применением этой миграции в среде с данными выполни
-- `npm run migrate:work-schedule-hours` (переносит существующие записи
-- в график и сбрасывает кэш расчёта открытых периодов).
DROP TABLE "employee_hours_entries";
