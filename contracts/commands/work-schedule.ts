import { z } from 'zod';
import { targetRoleSchema } from './salary-rule';

// График работы сотрудников (Фаза 1, docs/employee-work-schedule) — одна
// запись описывает ОДИН календарный день ОДНОГО сотрудника: работает он в
// этот день (и сколько часов, в какой роли) или отсутствует и почему.
// Сущность общая на компанию: у неё нет дискриминатора direction
// (service/shop), потому что человек — это BitrixEmployee, а не сотрудник
// направления, и контексты расчёта обоих направлений будут читать один и
// тот же график (см. PRD, "Технические ограничения").

// Статус дня. WORKING — единственный статус, у которого осмысленны часы и
// роль; остальные четыре различают ПРИЧИНУ отсутствия (она нужна
// мобильному экрану «Отдел сегодня» и счётчику дней отпуска), поэтому это
// не один общий ABSENT, а перечисление.
const workScheduleStatusSchema = z.enum([
    'WORKING',
    'DAY_OFF',
    'TIME_OFF',
    'SICK_LEAVE',
    'VACATION',
]);
export type WorkScheduleStatus = z.infer<typeof workScheduleStatusSchema>;

// Календарный день записи. Строка YYYY-MM-DD, а не z.coerce.date(): дата
// здесь — именно календарный день без времени и часового пояса (смена
// «5 августа» не должна уезжать на сутки при сериализации), плюс
// z.coerce.date() не сериализуется генератором OpenAPI (см. комментарий в
// src/config/swagger.config.ts).
const scheduleDateSchema = z
    .string()
    .regex(
        /^\d{4}-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/,
        'Дата должна быть в формате YYYY-MM-DD',
    );

// Часы смены: 2–16 с шагом 0,5 (см. PRD, "В скоупе" — слайдер часов в
// поповере редактирования дня). multipleOf, а не refine — так шаг попадает
// в OpenAPI-схему эндпоинта, а не теряется как непредставимая проверка.
const shiftHoursSchema = z
    .number()
    .min(2, 'Смена не может быть короче 2 часов')
    .max(16, 'Смена не может быть длиннее 16 часов')
    .multipleOf(0.5, 'Часы смены задаются с шагом 0,5');

const workScheduleEntrySchema = z.object({
    id: z.string(),
    employeeId: z.number(),
    date: scheduleDateSchema,
    status: workScheduleStatusSchema,
    // null у любого статуса, кроме WORKING — инвариант «часы и роль только
    // у рабочего дня» (проверяется доменом, см. WorkDay value object).
    hours: z.number().nullable(),
    role: targetRoleSchema.nullable(),
    createdAt: z.coerce.date(),
    updatedAt: z.coerce.date(),
});
export type WorkScheduleEntryResponse = z.infer<typeof workScheduleEntrySchema>;

// Заполнение дня — идемпотентный upsert по естественному ключу
// (employeeId, date), а не пара POST/PATCH: руководитель в UI не создаёт и
// не правит «запись», он просто выставляет ячейке таблицы состояние, и
// повторный клик по той же ячейке должен менять её, а не упираться в 409.
//
// Инвариант «hours/role допустимы только при status = WORKING» сознательно
// НЕ продублирован здесь (например, через superRefine): он живёт в домене
// (WorkDay), чтобы у правила было одно место определения; клиент в обоих
// случаях получает 400 (ArgumentInvalidException → BAD_REQUEST, см.
// DomainExceptionFilter).
const upsertWorkScheduleEntryRequestSchema = z.object({
    employeeId: z.number().int().positive(),
    date: scheduleDateSchema,
    status: workScheduleStatusSchema,
    hours: shiftHoursSchema.optional(),
    role: targetRoleSchema.optional(),
});
export type UpsertWorkScheduleEntryRequest = z.infer<
    typeof upsertWorkScheduleEntryRequestSchema
>;

// Месяц графика в формате 'YYYY-MM' — тот же формат/шаблон, что и period в
// contracts/commands/employee-hours-entry.ts и backend Period value object
// (shared/domain/period.value-object.ts), но своя копия схемы: у модуля
// графика нет зависимости на accounting, а формат достаточно простой, чтобы
// не заводить общий контрактный тип ради одного regexp (тот же выбор уже
// сделан в employee-hours-entry.ts).
const workScheduleMonthSchema = z
    .string()
    .regex(/^\d{4}-(0[1-9]|1[0-2])$/, 'Месяц должен быть в формате YYYY-MM');
export type WorkScheduleMonth = z.infer<typeof workScheduleMonthSchema>;

// GET /v1/work-schedule?month=&departmentId= (Фаза 3, docs/employee-work-schedule)
// — вся таблица «сотрудники × дни месяца» одним запросом. departmentId не
// передан — сотрудники всех отделов, тем же приёмом, что и
// listEmployeesQuerySchema в contracts/commands/directory.ts.
const getMonthlyWorkScheduleQuerySchema = z.object({
    month: workScheduleMonthSchema,
    departmentId: z.coerce.number().int().positive().optional(),
});
export type GetMonthlyWorkScheduleQuery = z.infer<
    typeof getMonthlyWorkScheduleQuerySchema
>;

// Одна ячейка таблицы — один день одного сотрудника. status: null означает
// «день не заполнен» (записи графика нет вообще) — отдельное от любого из
// пяти статусов состояние, поэтому не в workScheduleStatusSchema, а
// .nullable() поверх неё (см. PRD, критерий готовности: "для месяца без
// данных — пустые ячейки без ошибки").
const workScheduleDayCellSchema = z.object({
    date: scheduleDateSchema,
    entryId: z.string().nullable(),
    status: workScheduleStatusSchema.nullable(),
    hours: z.number().nullable(),
    role: targetRoleSchema.nullable(),
});
export type WorkScheduleDayCell = z.infer<typeof workScheduleDayCellSchema>;

// Строка сотрудника в таблице месяца: days — по одной ячейке на каждый
// календарный день месяца (28-31, PRD, критерий готовности), плюс три
// итога, которые PRD требует видеть в строке/поповере сотрудника без
// отдельного запроса — часы за месяц и остаток отпуска на год
// (vacationDaysLimit - vacationDaysUsed) считаются один раз на бэкенде
// (см. PRD, "Технические ограничения": "агрегаты считаются на бэкенде, а
// не в браузере").
const workScheduleEmployeeRowSchema = z.object({
    employeeId: z.number(),
    name: z.string(),
    departmentId: z.number(),
    days: z.array(workScheduleDayCellSchema),
    totalHours: z.number(),
    // Использованные дни отпуска — за календарный год месяца из запроса
    // (не только за отображаемый месяц): годовой лимит осмысленен только в
    // паре с использованием за тот же год (PRD, сценарий "видно остаток
    // дней отпуска на текущий год").
    vacationDaysUsed: z.number(),
    vacationDaysLimit: z.number(),
});
export type WorkScheduleEmployeeRow = z.infer<
    typeof workScheduleEmployeeRowSchema
>;

// Агрегат одного дня месяца по всем сотрудникам ответа — источник строки
// «Человек в смене» (PRD, "В скоупе").
const workScheduleDayAggregateSchema = z.object({
    date: scheduleDateSchema,
    peopleOnShift: z.number(),
});
export type WorkScheduleDayAggregate = z.infer<
    typeof workScheduleDayAggregateSchema
>;

const monthlyWorkScheduleResponseSchema = z.object({
    month: workScheduleMonthSchema,
    // Отражает departmentId запроса как есть (null — фильтра не было), а
    // не «отдел первого сотрудника»: ответ может быть пустым (сотрудников
    // нет), и тогда единственный источник фильтра для клиента — это поле.
    departmentId: z.number().nullable(),
    employees: z.array(workScheduleEmployeeRowSchema),
    days: z.array(workScheduleDayAggregateSchema),
    // Общий фонд часов месяца — сумма totalHours всех сотрудников ответа
    // (PRD, "В скоупе": "общий фонд часов за месяц").
    totalHours: z.number(),
});
export type MonthlyWorkScheduleResponse = z.infer<
    typeof monthlyWorkScheduleResponseSchema
>;

export {
    workScheduleStatusSchema,
    scheduleDateSchema,
    shiftHoursSchema,
    workScheduleEntrySchema,
    upsertWorkScheduleEntryRequestSchema,
    workScheduleMonthSchema,
    getMonthlyWorkScheduleQuerySchema,
    workScheduleDayCellSchema,
    workScheduleEmployeeRowSchema,
    workScheduleDayAggregateSchema,
    monthlyWorkScheduleResponseSchema,
};
