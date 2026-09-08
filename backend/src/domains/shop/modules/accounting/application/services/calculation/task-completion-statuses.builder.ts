import type { TaskRepositoryPort } from '@/modules/tasks/application/ports/task.repository.port';
import type { ShopSalaryRule } from '@/domains/shop/modules/accounting/domain/types/salary-rule.types';
import type { ShopCalculationErpData } from '@/domains/shop/modules/accounting/domain/types/calculation-data.types';
import { ShopSalaryTask } from '@/domains/shop/modules/accounting/domain/entities/salary-task/salary-task.entity';

// openspec/changes/replace-bitrix-task-integration, design.md решение 5 —
// зеркало task-completion-statuses.builder.ts направления service
// (независимая копия, issue #57). Заполняет erpData.taskCompletionStatuses
// статусами ShopSalaryTask ТЕКУЩЕГО периода для всех TaskCompletion-правил
// переданной схемы/набора правил.
// Переиспользуется в двух местах, у которых нет общего родителя:
// BuildShopCalculationContextService (отчёт сотрудника) и
// GetShopDepartmentSalaryReportService (батч на отдел, erpData которого
// собирается вручную, без контекст-билдера) — вынесено сюда как
// самостоятельная функция, а не метод одного из двух сервисов, чтобы не
// плодить зависимость одного от другого.
//
// Единственное место accounting, что всё ещё инжектит TASK_REPOSITORY из
// src/modules/tasks (design.md решение 5) — напрямую, без Port/Adapter
// поверх: собирает taskId из config.taskIdByPeriod[period] каждого своего
// TaskCompletion-правила, зовёт TASK_REPOSITORY.findManyByIds(taskIds), и
// для каждого полученного Task сразу конструирует
// ShopSalaryTask.create({taskId: task.id, status: task.status.code}).
export async function findTaskCompletionTasks(
    taskRepo: TaskRepositoryPort,
    rules: ShopSalaryRule[],
    period: string,
): Promise<ShopSalaryTask[]> {
    const taskIds = collectTaskIdsForPeriod(rules, period);

    // Ни одного связанного taskId за этот период — не делаем лишний запрос
    // в БД (тот же приём, что и TASK_REPOSITORY.findManyByIds с пустым
    // списком).
    if (taskIds.length === 0) {
        return [];
    }

    const tasks = await taskRepo.findManyByIds(taskIds);
    return tasks.map((task) =>
        ShopSalaryTask.create({ taskId: task.id, status: task.status.code }),
    );
}

// Ключ по ruleId — не по taskId: TaskCompletionShop.calculate() читает
// карту по this.id (см. task-completion.entity.ts), а не по id задачи.
// Ссылка на несуществующий taskId (design.md Risks) — TASK_REPOSITORY.
// findManyByIds() просто не вернёт такую задачу, правило останется без
// записи в карте, тот же код пути, что и "задача не заведена".
export async function buildTaskCompletionStatuses(
    taskRepo: TaskRepositoryPort,
    rules: ShopSalaryRule[],
    period: string,
): Promise<NonNullable<ShopCalculationErpData['taskCompletionStatuses']>> {
    const tasks = await findTaskCompletionTasks(taskRepo, rules, period);
    return taskCompletionStatusesByRuleId(rules, period, tasks);
}

export function taskCompletionStatusesByRuleId(
    rules: ShopSalaryRule[],
    period: string,
    tasks: ShopSalaryTask[],
): NonNullable<ShopCalculationErpData['taskCompletionStatuses']> {
    const taskById = new Map(tasks.map((task) => [task.taskId, task]));
    const statuses: NonNullable<
        ShopCalculationErpData['taskCompletionStatuses']
    > = {};
    for (const rule of rules) {
        if (rule.type !== 'TaskCompletion') {
            continue;
        }
        const taskId = taskIdForPeriod(rule, period);
        const task = taskId ? taskById.get(taskId) : undefined;
        if (task) {
            statuses[rule.id] = task;
        }
    }
    return statuses;
}

function collectTaskIdsForPeriod(
    rules: ShopSalaryRule[],
    period: string,
): string[] {
    const ids = new Set<string>();
    for (const rule of rules) {
        if (rule.type !== 'TaskCompletion') {
            continue;
        }
        const taskId = taskIdForPeriod(rule, period);
        if (taskId) {
            ids.add(taskId);
        }
    }
    return [...ids];
}

function taskIdForPeriod(
    rule: ShopSalaryRule,
    period: string,
): string | undefined {
    const config = rule.config as { taskIdByPeriod?: Record<string, string> };
    return config.taskIdByPeriod?.[period];
}

// AccountingCacheFreshness'а три источника инвалидации (schema/domainSync/
// salesPlan) не знают про ShopSalaryTask — статус связанной задачи
// TaskCompletion-правила теперь меняется мгновенно (self-service переходы
// модуля tasks), и ни одно из трёх событий с этим изменением не связано.
// Без этого штампа переход задачи в CLOSED_SUCCESSFULLY не инвалидирует уже
// посчитанный кэш открытого периода — строка правила остаётся невидимой в
// отчёте до случайного совпадения с одним из трёх других источников.
export function taskCompletionFreshnessStamp(tasks: ShopSalaryTask[]): string {
    // ShopSalaryTask — эфемерная сущность без updatedAt (не персистентная,
    // не несёт метаданных Task, см. design.md решение 5) — штамп свежести
    // строится по набору (id, status) задач, а не по их дате изменения:
    // любое изменение статуса меняет саму карту, дата здесь не нужна.
    return tasks
        .map((task) => `${task.taskId}:${task.status}`)
        .sort()
        .join(',');
}
