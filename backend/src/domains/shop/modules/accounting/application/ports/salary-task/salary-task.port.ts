import { ShopSalaryTask } from '@/domains/shop/modules/accounting/domain/entities/salary-task/salary-task.entity';

// Раздел 14 tasks.md (add-task-based-salary-rule) — независимая копия
// порта (зеркало domains/service/modules/accounting/application/ports/
// salary-task/salary-task.port.ts, раздел 9, issue #57). Реализация
// (ShopSalaryTaskRepository) ВСЕГДА подставляет/фильтрует
// direction: 'shop' — ни один метод порта не принимает direction
// параметром снаружи (backend/CLAUDE.md — изоляция направлений на уровне
// кода, не данных: общая таблица salary_tasks, design.md Decision 1).
export interface ShopSalaryTaskRepositoryPort {
    // Идемпотентность EnsureShopSalaryTaskForPeriodService.ensure()
    // (раздел 16, design.md Decision 1/4) — последний рубеж защиты от
    // повторного создания задачи в Bitrix24 на тот же период опирается на
    // уникальный индекс (salaryRuleId, period) в Prisma, это чтение —
    // первый (не последний) рубеж.
    findByRuleAndPeriod(
        salaryRuleId: string,
        period: string,
    ): Promise<ShopSalaryTask | null>;

    // Активные (не переведённые в "Завершена") задачи направления shop —
    // источник для SalaryTaskStatusSyncCron (раздел 8, общая
    // инфраструктура; тот крон читает salary_tasks напрямую через
    // DatabaseService, а не через этот метод, см. WHY в
    // SalaryTaskStatusSyncService) и для остальной прикладной логики
    // раздела 16/18, которой нужен список активных задач без повторного
    // опроса каждой по отдельности.
    findActiveForDirection(): Promise<ShopSalaryTask[]>;

    insert(entity: ShopSalaryTask): Promise<void>;

    save(entity: ShopSalaryTask): Promise<void>;

    // Раздел 17 tasks.md (add-task-based-salary-rule) — батч-версия
    // findByRuleAndPeriod для сборки erpData.taskCompletionStatuses
    // (BuildShopCalculationContextService/GetShopDepartmentSalaryReportService,
    // зеркало SalaryTaskRepositoryPort.findManyByRulesAndPeriod направления
    // service, раздел 12): один запрос на ВСЕ TaskCompletion-правила
    // схемы/отдела за конкретный период, а не по одному вызову на правило.
    // Пустой список правил — не делает запрос, возвращает [] (см.
    // реализацию).
    findManyByRulesAndPeriod(
        salaryRuleIds: string[],
        period: string,
    ): Promise<ShopSalaryTask[]>;

    // Раздел 17 tasks.md — ВСЕ ещё не завершённые задачи конкретного
    // правила, вне зависимости от периода (зеркало findActiveByRule
    // направления service, раздел 12). Нужен UpdateShopMotivationSchemaHandler
    // при удалении правила TaskCompletion (design.md Decision 6,
    // «закрывается задача в Bitrix24, затем удаляется запись») — разовое
    // правило может быть удалено в периоде, отличном от периода создания
    // его единственной задачи, поэтому поиск "по текущему периоду" не нашёл
    // бы её вовсе.
    findActiveByRule(salaryRuleId: string): Promise<ShopSalaryTask[]>;
}

export const SHOP_SALARY_TASK_REPOSITORY = Symbol(
    'SHOP_SALARY_TASK_REPOSITORY',
);
