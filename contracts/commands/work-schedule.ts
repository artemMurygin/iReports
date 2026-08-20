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

export {
    workScheduleStatusSchema,
    scheduleDateSchema,
    shiftHoursSchema,
    workScheduleEntrySchema,
    upsertWorkScheduleEntryRequestSchema,
};
