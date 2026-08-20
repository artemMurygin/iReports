import { ShopMotivationSchema } from '@/domains/shop/modules/accounting/domain/entities/shop-motivation-schema.entity';

// Зеркало domains/service/modules/accounting/application/ports/
// motivation-schema.port.ts (Фаза 13.5, issue #57) — независимая копия для
// направления shop. Порт объявляет только реально используемые операции.
export interface ShopMotivationSchemaRepositoryPort {
    insert(entity: ShopMotivationSchema): Promise<void>;

    // ЛИЧНАЯ схема мотивации сотрудника (targetType = 'Employee') вместе с
    // её правилами. Схему его отдела этот метод не возвращает — обе схемы
    // сводит воедино ResolveShopEmployeeSalaryRulesService, единственный
    // легальный вход к правилам сотрудника для расчёта (см. его шапку).
    // Звать findByEmployee напрямую из расчёта нельзя: сотрудник без личной
    // схемы, но со схемой на отдел, получил бы пустой набор правил и нули в
    // отчёте.
    findByEmployee(employeeId: number): Promise<ShopMotivationSchema | null>;

    // Схема, нацеленная на отдел (targetType = 'Department') — вторая
    // половина набора правил сотрудника (см. findByEmployee выше).
    findByDepartment(
        departmentId: number,
    ): Promise<ShopMotivationSchema | null>;

    // Все схемы, нацеленные на сотрудника (targetType = 'Employee') — одна
    // из двух половин входа закрытия периода направления shop; вторая —
    // findAllDepartmentTargets().
    findAllEmployeeTargets(): Promise<ShopMotivationSchema[]>;

    // Все схемы, нацеленные на отдел (targetType = 'Department') — вторая
    // половина входа закрытия периода: хендлер разворачивает каждую такую
    // схему в сотрудников её отдела, чтобы снапшот покрывал и тех, у кого
    // личной схемы нет (иначе закрытие месяца зафиксировало бы им ноль).
    findAllDepartmentTargets(): Promise<ShopMotivationSchema[]>;

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

    // Страница просмотра/редактирования зарплатных схем (список + деталь +
    // PATCH) — findById/findAll читают строку(и) motivation_schemas с
    // правилами, отфильтрованными по direction='shop' (тот же приём, что и
    // findByEmployee выше); строка с 0 правилами направления shop
    // трактуется вызывающим application-сервисом как «схемы для shop нет»
    // (404 у findById, отбрасывается из выдачи у findAll) — сам репозиторий
    // такую фильтрацию не делает, только маппит include.
    findById(id: string): Promise<ShopMotivationSchema | null>;

    findAll(filters: {
        targetType?: 'Department' | 'Employee';
        targetId?: number;
        search?: string;
    }): Promise<ShopMotivationSchema[]>;

    // Персист переименования (ShopMotivationSchema.rename()) — только
    // name, target/rules этим методом не меняются.
    update(entity: ShopMotivationSchema): Promise<void>;
}

export const SHOP_MOTIVATION_SCHEMA_REPOSITORY = Symbol(
    'SHOP_MOTIVATION_SCHEMA_REPOSITORY',
);
