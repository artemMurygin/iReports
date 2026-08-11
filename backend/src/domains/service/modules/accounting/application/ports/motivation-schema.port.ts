import { MotivationSchema } from '@/domains/service/modules/accounting/domain/entities/motivation-schema.entity';

// Порт объявляет только реально используемые операции (insert из
// CreateMotivationSchemaHandler, findByEmployee из
// GetEmployeeSalaryReportService). Методы вроде findAll/delete добавляются
// сюда, когда появляется конкретный вызывающий код, а не заранее.
export interface MotivationSchemaRepositoryPort {
    insert(entity: MotivationSchema): Promise<void>;

    // Схема мотивации сотрудника (targetType = 'Employee') вместе с её
    // правилами. Схем на отдел (targetType = 'Department') здесь
    // сознательно не ищем — их учёт в отчёте сотрудника не входит в Фазу 1.
    findByEmployee(employeeId: number): Promise<MotivationSchema | null>;

    // Все схемы, нацеленные на сотрудника (targetType = 'Employee') — вход
    // закрытия периода (Фаза 6, CloseAccountingPeriodHandler): снапшот
    // строится по каждому сотруднику с личной схемой, а не по всем
    // Bitrix-сотрудникам компании (у схем на отдел своя, ещё не
    // реализованная логика раскрытия, см. PRD раздел "Мотивационные схемы").
    findAllEmployeeTargets(): Promise<MotivationSchema[]>;

    // Батч-версия findByEmployee для отчёта по отделу (Фаза 9,
    // GetDepartmentSalaryReportService) — один запрос вместо одного на
    // сотрудника ("не должно быть N+1 запросов при расчёте отдела").
    // Сотрудники без личной схемы просто отсутствуют в результате.
    findByEmployees(employeeIds: number[]): Promise<MotivationSchema[]>;

    // Find-or-create guard для CreateMotivationSchemaHandler (Фаза 13.5): у
    // MotivationSchema в БД нет колонки direction, естественный ключ — только
    // (targetType, targetId). Сотрудник с идентичностями в обеих ERP может
    // получить create-запрос сначала с сервисной, потом с shop-стороны (или
    // наоборот) на один и тот же targetId — без этой проверки вставились бы
    // две строки на одного и того же сотрудника, и findByEmployee (findFirst)
    // непредсказуемо находил бы только одну из них.
    findIdByTarget(
        targetType: string,
        targetId: number,
    ): Promise<string | null>;
}

export const MOTIVATION_SCHEMA_REPOSITORY = Symbol(
    'MOTIVATION_SCHEMA_REPOSITORY',
);
