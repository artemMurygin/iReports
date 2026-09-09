import { SalaryTask } from '@/domains/service/modules/accounting/domain/entities/salary-task/salary-task.entity';

// Раздел 9 tasks.md (add-task-based-salary-rule): порт над общей таблицей
// salary_tasks (design.md Decision 1) для направления service — реализация
// (SalaryTaskRepository, infrastructure/repositories/salary-task/) ВСЕГДА
// подставляет/фильтрует direction: 'service' и не принимает его параметром
// снаружи (backend/CLAUDE.md, "Общие таблицы между service и shop" —
// изоляция направлений на уровне кода). Зеркало —
// ShopSalaryTaskRepositoryPort/SHOP_SALARY_TASK_REPOSITORY (раздел 14),
// независимый порт в domains/shop.
export interface SalaryTaskRepositoryPort {
    // Идемпотентность автосоздания (EnsureSalaryTaskForPeriodService,
    // раздел 11, design.md Decision 4) — null, если для этого правила ещё
    // нет задачи за этот период.
    findByRuleAndPeriod(
        salaryRuleId: string,
        period: string,
    ): Promise<SalaryTask | null>;

    // Поллинг статусов (SalaryTaskStatusSyncService, раздел 8) читает
    // активные задачи ОБОИХ направлений одним запросом напрямую через
    // DatabaseService (см. WHY там) — этот метод обслуживает остальных
    // потребителей домена service, которым нужен тот же список (например,
    // будущую диагностику/отчётность направления). Без параметра —
    // направление зашито в реализации, не принимается снаружи.
    findActiveForDirection(): Promise<SalaryTask[]>;

    // Создание новой записи. Уникальный индекс (salaryRuleId, period) —
    // последний рубеж защиты от гонки (design.md Decision 1/4): повторная
    // вставка бросает SalaryTaskAlreadyExistsException, а не сырой Prisma-
    // эксепшн (domain/exceptions/salary-task.exception.ts).
    insert(entity: SalaryTask): Promise<void>;

    // Персист УЖЕ существующей записи по id (например, после markStatus()
    // при создании/закрытии задачи из правила, раздел 12) — не upsert, в
    // отличие от AccountingPeriodRepositoryPort.save (там естественный ключ
    // может ещё не существовать; здесь запись создаётся только через
    // insert()).
    save(entity: SalaryTask): Promise<void>;

    // Раздел 12 tasks.md — батч-версия findByRuleAndPeriod для сборки
    // erpData.taskCompletionStatuses (BuildServiceCalculationContextService/
    // GetDepartmentSalaryReportService): один запрос на ВСЕ TaskCompletion-
    // правила схемы/отдела за конкретный период, а не по одному вызову на
    // правило ("не должно быть N+1 запросов", тот же принцип, что и у
    // batch-методов ServiceCalculationDataPort). Пустой список правил — не
    // делает запрос, возвращает [] (см. реализацию).
    findManyByRulesAndPeriod(
        salaryRuleIds: string[],
        period: string,
    ): Promise<SalaryTask[]>;

    // Раздел 12 tasks.md — ВСЕ ещё не завершённые задачи конкретного
    // правила, вне зависимости от периода (в отличие от
    // findByRuleAndPeriod/findManyByRulesAndPeriod выше). Нужен
    // UpdateMotivationSchemaHandler при удалении правила TaskCompletion
    // (design.md Decision 6, «закрывается задача в Bitrix24, затем
    // удаляется запись») — разовое правило может быть удалено в периоде,
    // отличном от периода создания его единственной задачи, поэтому поиск
    // "по текущему периоду" не нашёл бы её вовсе.
    findActiveByRule(salaryRuleId: string): Promise<SalaryTask[]>;
}

export const SALARY_TASK_REPOSITORY = Symbol('SALARY_TASK_REPOSITORY');
