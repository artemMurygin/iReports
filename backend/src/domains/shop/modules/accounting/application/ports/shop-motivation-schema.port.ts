import { ShopMotivationSchema } from '@/domains/shop/modules/accounting/domain/entities/shop-motivation-schema.entity';

// Зеркало domains/service/modules/accounting/application/ports/
// motivation-schema.port.ts (Фаза 13.5, issue #57) — независимая копия для
// направления shop. Порт объявляет только реально используемые операции.
export interface ShopMotivationSchemaRepositoryPort {
    insert(entity: ShopMotivationSchema): Promise<void>;

    // Схема мотивации сотрудника (targetType = 'Employee') вместе с её
    // правилами. Схем на отдел (targetType = 'Department') здесь
    // сознательно не ищем — их учёт в отчёте сотрудника не входит в эту
    // фазу.
    findByEmployee(employeeId: number): Promise<ShopMotivationSchema | null>;

    // Все схемы, нацеленные на сотрудника (targetType = 'Employee') — вход
    // закрытия периода направления shop.
    findAllEmployeeTargets(): Promise<ShopMotivationSchema[]>;

    // Батч-версия findByEmployee для отчёта по отделу — один запрос вместо
    // одного на сотрудника ("не должно быть N+1 запросов при расчёте
    // отдела"). Сотрудники без личной схемы просто отсутствуют в результате.
    findByEmployees(employeeIds: number[]): Promise<ShopMotivationSchema[]>;

    // Find-or-create guard для CreateShopMotivationSchemaHandler (Фаза
    // 13.5, реализуется в фазе 2): у MotivationSchema в БД нет колонки
    // direction, естественный ключ — только (targetType, targetId).
    // Сотрудник с идентичностями в обеих ERP может получить create-запрос
    // сначала с shop-, потом с сервисной стороны (или наоборот) на один и
    // тот же targetId — без этой проверки вставились бы две строки на
    // одного и того же сотрудника, и findByEmployee (findFirst)
    // непредсказуемо находил бы только одну из них.
    findIdByTarget(
        targetType: 'Department' | 'Employee',
        targetId: number,
    ): Promise<string | null>;
}

export const SHOP_MOTIVATION_SCHEMA_REPOSITORY = Symbol(
    'SHOP_MOTIVATION_SCHEMA_REPOSITORY',
);
