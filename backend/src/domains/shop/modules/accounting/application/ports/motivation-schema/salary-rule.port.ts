import { ShopSalaryRule } from '@/domains/shop/modules/accounting/domain/types/salary-rule.types';

// Зеркало domains/service/modules/accounting/application/ports/
// salary-rule.port.ts (Фаза 13.5, issue #57) — независимая копия для
// направления shop. Порт объявляет только реально используемую операцию
// (сейчас — только insert из CreateShopSalaryRuleHandler). Методы вроде
// findAll/delete добавляются сюда, когда появляется конкретный вызывающий
// код, а не заранее.
export interface ShopSalaryRuleRepositoryPort {
    insert(
        entity: ShopSalaryRule,
        meta: { motivationSchemaId: string },
    ): Promise<void>;

    // PATCH /v1/shop/accounting/motivation-schema/:id (редактирование
    // схемы) — удаляет ТОЛЬКО правила, которых нет в новом наборе из тела
    // запроса (diff по id, см. UpdateShopMotivationSchemaHandler) — не
    // полная замена, иначе TaskCompletion теряет привязку к своим задачам
    // при каждом PATCH, даже когда правило не менялось (openspec/changes/
    // replace-bitrix-task-integration, design.md решение 3/5). Реализация
    // фиксирует
    // direction='shop' в WHERE — критично: у одной строки motivation_schemas
    // может быть смешанный набор правил service+shop (сотрудник с
    // идентичностями в обеих ERP, см. комментарий у SalaryRule.direction в
    // salary.prisma), удаление не должно задевать чужие (service) правила
    // той же схемы. Пустой список — no-op, без запроса.
    deleteByIds(ruleIds: string[]): Promise<void>;

    // Персист правила ПОСЛЕ создания (не insert — сущность уже существует в
    // БД), для точечных мутаций props правила in-place — используется
    // UpdateShopMotivationSchemaHandler для правил, сохранившихся между
    // PATCH (совпали по id), чтобы id/config.taskIdByPeriod (у
    // TaskCompletion) не терялись при правке содержимого правила, и
    // EnsureShopSalaryTaskForPeriodService.ensure() для сохранения нового
    // taskId периода.
    update(entity: ShopSalaryRule): Promise<void>;

    // Правило по id, для чтения TaskCompletionShopSalaryConfig в
    // EnsureShopSalaryTaskForPeriodService.ensure(). null, если правила с
    // таким id нет либо оно принадлежит направлению service (та же
    // фильтрация direction='shop' в WHERE, что и у остальных методов этого
    // порта) — тот же плоский тип ShopSalaryRule, что и у зеркального
    // метода направления service. assigneeEmployeeId для CreateTaskCommand
    // — забота ВЫЗЫВАЮЩЕГО кода (report-сервисы уже знают employeeId, см.
    // EnsureShopSalaryTaskForPeriodService.ensure()), этот метод не
    // обходит мотивационные схемы и не резолвит ответственного.
    findById(ruleId: string): Promise<ShopSalaryRule | null>;

    // Раздел 15 tasks.md (add-task-salary-rule-links-comments) — зеркало
    // domains/service/modules/accounting'ного findByTaskId (issue #57,
    // независимая копия): правило вида TaskCompletion, чей
    // config.taskIdByPeriod ТЕКУЩЕГО расчётного периода равен taskId (см.
    // design.md решение 4 — полное сканирование правил домена без отдельной
    // индексной таблицы). null — ни одно правило домена shop не ссылается
    // на эту задачу в текущем периоде. spec:
    // shop/accounting#requirement-зарплатное-правило-и-начисление-доступны-для-поиска-по-идентификатору-задачи
    findByTaskId(taskId: string): Promise<ShopSalaryRule | null>;

    // deactivate-one-off-task-completion-rule, tasks.md раздел 3 — зеркало
    // domains/service/.../salary-rule.port.ts'ного findOneOffByAnyTaskId
    // (независимая копия). В отличие от findByTaskId выше (только ТЕКУЩИЙ
    // период — для панели связей задачи), сканирует ЛЮБОЕ значение
    // config.taskIdByPeriod: разовое правило может быть создано в прошлом
    // расчётном периоде, и его единственная задача может закрыться позже,
    // уже после смещения текущего периода (design.md решение 3). Находит
    // только разовое правило (config.isRecurring === false) — регулярное
    // правило этим методом не находится и не деактивируется ни при каком
    // статусе задачи (design.md Non-Goals). null — ни одно разовое правило
    // домена shop не ссылается на taskId ни в одном периоде, либо
    // единственное совпадение принадлежит регулярному правилу. spec:
    // deactivate-one-off-task-completion-rule/shop/accounting#requirement-разовое-правило-за-выполнение-задачи-деактивируется-по-исходу-задачи
    findOneOffByAnyTaskId(taskId: string): Promise<ShopSalaryRule | null>;

    // Раздел 18 tasks.md — motivationSchemaId правила (см. WHY у
    // findMotivationSchemaId направления service) — нужен
    // GetShopSalaryRuleService для резолвинга названия мотивационной схемы.
    findMotivationSchemaId(ruleId: string): Promise<string | null>;
}

export const SHOP_SALARY_RULE_REPOSITORY = Symbol(
    'SHOP_SALARY_RULE_REPOSITORY',
);
