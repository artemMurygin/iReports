import { MotivationSchema } from '@/domains/service/modules/accounting/domain/entities/motivation-schema/motivation-schema.entity';

// Порт объявляет только реально используемые операции (insert из
// CreateMotivationSchemaHandler, findByEmployee из
// GetEmployeeSalaryReportService). Методы вроде findAll/delete добавляются
// сюда, когда появляется конкретный вызывающий код, а не заранее.
export interface MotivationSchemaRepositoryPort {
    insert(entity: MotivationSchema): Promise<void>;

    // ЛИЧНАЯ схема мотивации сотрудника (targetType = 'Employee') вместе с
    // её правилами. Схему его отдела этот метод не возвращает — обе схемы
    // сводит воедино ResolveEmployeeSalaryRulesService, единственный
    // легальный вход к правилам сотрудника для расчёта (см. его шапку).
    // Звать findByEmployee напрямую из расчёта нельзя: сотрудник без личной
    // схемы, но со схемой на отдел, получил бы пустой набор правил и нули в
    // отчёте.
    findByEmployee(employeeId: number): Promise<MotivationSchema | null>;

    // Схема, нацеленная на отдел (targetType = 'Department') — вторая
    // половина набора правил сотрудника (см. findByEmployee выше).
    findByDepartment(departmentId: number): Promise<MotivationSchema | null>;

    // Все схемы, нацеленные на сотрудника (targetType = 'Employee') — одна
    // из двух половин входа закрытия периода (Фаза 6,
    // CloseAccountingPeriodHandler); вторая — findAllDepartmentTargets().
    findAllEmployeeTargets(): Promise<MotivationSchema[]>;

    // Все схемы, нацеленные на отдел (targetType = 'Department') — вторая
    // половина входа закрытия периода: хендлер разворачивает каждую такую
    // схему в сотрудников её отдела, чтобы снапшот покрывал и тех, у кого
    // личной схемы нет (иначе закрытие месяца зафиксировало бы им ноль).
    findAllDepartmentTargets(): Promise<MotivationSchema[]>;

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

    // Деталь схемы (GET .../motivation-schema/:id) — rules отфильтрованы по
    // direction='service' на уровне Prisma-запроса, тот же приём, что и у
    // findByEmployee выше. Схема с 0 правилами этого направления (все
    // правила принадлежат shop-стороне той же строки) для домена service
    // трактуется как не найденная — эту проверку делает вызывающий
    // application-сервис/хендлер, а не репозиторий.
    findById(id: string): Promise<MotivationSchema | null>;

    // Список схем направления service (GET .../motivation-schema) с
    // опциональными фильтрами по цели и подстрокой имени. rules
    // отфильтрованы по direction='service' тем же приёмом.
    findAll(filters: {
        targetType?: string;
        targetId?: number;
        search?: string;
    }): Promise<MotivationSchema[]>;

    // Персист переименования (PATCH .../motivation-schema/:id) — только имя,
    // targetType/targetId/rules этим методом не трогаются. Пишет ТОЛЬКО
    // direction-специфичную колонку (service_name) — см. комментарий у
    // serviceName в salary.prisma; общая с shop колонка `name` этим методом
    // больше не трогается (кросс-направленческий баг переименования).
    update(entity: MotivationSchema): Promise<void>;

    // Find-or-create для CreateMotivationSchemaHandler: строка
    // motivation_schemas может уже существовать (найдена по findIdByTarget
    // раньше со стороны shop для того же targetType/targetId), но ни разу
    // не видела create-запрос со стороны service — тогда её serviceName
    // всё ещё NULL (фолбэк на общий `name`). Устанавливает serviceName
    // строки ТОЛЬКО если он ещё не задан (идемпотентно, атомарно через
    // condition в WHERE) — повторный POST с другим name НЕ переименовывает
    // уже инициализированную схему, это ответственность PATCH/update()
    // выше, не create.
    initializeName(id: string, name: string): Promise<void>;
}

export const MOTIVATION_SCHEMA_REPOSITORY = Symbol(
    'MOTIVATION_SCHEMA_REPOSITORY',
);
