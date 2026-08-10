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
}

export const MOTIVATION_SCHEMA_REPOSITORY = Symbol(
    'MOTIVATION_SCHEMA_REPOSITORY',
);
