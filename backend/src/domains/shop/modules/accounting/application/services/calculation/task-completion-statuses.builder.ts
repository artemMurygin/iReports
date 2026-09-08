import type { ShopSalaryRule } from '@/domains/shop/modules/accounting/domain/types/salary-rule.types';
import type { ShopSalaryTaskRepositoryPort } from '@/domains/shop/modules/accounting/application/ports/salary-task/salary-task.port';
import type { ShopCalculationErpData } from '@/domains/shop/modules/accounting/domain/types/calculation-data.types';
import type { ShopSalaryTask } from '@/domains/shop/modules/accounting/domain/entities/salary-task/salary-task.entity';
import { AccountingCacheFreshness } from '@/domains/shop/modules/accounting/domain/services/accounting-cache-freshness';

// Раздел 17 tasks.md (add-task-based-salary-rule) — зеркало
// task-completion-statuses.builder.ts направления service (раздел 12,
// issue #57 — независимая копия). Заполняет
// erpData.taskCompletionStatuses статусами ShopSalaryTask ТЕКУЩЕГО периода
// для всех TaskCompletion-правил переданной схемы/набора правил.
// Переиспользуется в двух местах, у которых нет общего родителя:
// BuildShopCalculationContextService (отчёт сотрудника) и
// GetShopDepartmentSalaryReportService (батч на отдел, erpData которого
// собирается вручную, без контекст-билдера) — вынесено сюда как
// самостоятельная функция, а не метод одного из двух сервисов, чтобы не
// плодить зависимость одного от другого.
//
// Правило не ходит в БД само (см. calculation-context.ts) — этот
// application-сервис единственный, кто читает ShopSalaryTaskRepositoryPort
// ради заполнения контекста; TaskCompletionShop.calculate() лишь читает
// готовую карту по своему this.id.
// Общая часть buildTaskCompletionStatuses/taskCompletionFreshnessStamp ниже
// — оба хотят один и тот же список ShopSalaryTask (правило → задача текущего
// периода), но по разным причинам (карта для расчёта / штамп для инвалидации
// кэша, см. WHY у taskCompletionFreshnessStamp), поэтому запрос вынесен сюда
// один раз вместо дублирования в обеих функциях.
export async function findTaskCompletionTasks(
    taskRepo: ShopSalaryTaskRepositoryPort,
    rules: ShopSalaryRule[],
    period: string,
): Promise<ShopSalaryTask[]> {
    const taskCompletionRuleIds = rules
        .filter((rule) => rule.type === 'TaskCompletion')
        .map((rule) => rule.id);

    // Ни одного TaskCompletion-правила — не делаем лишний запрос в БД (тот
    // же приём, что и findManyByRulesAndPeriod с пустым списком, см. WHY
    // там).
    if (taskCompletionRuleIds.length === 0) {
        return [];
    }

    return taskRepo.findManyByRulesAndPeriod(taskCompletionRuleIds, period);
}

export async function buildTaskCompletionStatuses(
    taskRepo: ShopSalaryTaskRepositoryPort,
    rules: ShopSalaryRule[],
    period: string,
): Promise<NonNullable<ShopCalculationErpData['taskCompletionStatuses']>> {
    const tasks = await findTaskCompletionTasks(taskRepo, rules, period);
    return taskCompletionStatusesFromTasks(tasks);
}

export function taskCompletionStatusesFromTasks(
    tasks: ShopSalaryTask[],
): NonNullable<ShopCalculationErpData['taskCompletionStatuses']> {
    const statuses: NonNullable<
        ShopCalculationErpData['taskCompletionStatuses']
    > = {};
    for (const task of tasks) {
        statuses[task.salaryRuleId] = {
            bitrixTaskId: task.bitrixTaskId,
            status: task.taskStatus,
        };
    }
    return statuses;
}

// AccountingCacheFreshness'а три источника инвалидации (schema/domainSync/
// salesPlan) не знают про ShopSalaryTask — статус связанной задачи
// TaskCompletion-правила меняется отдельно (SalaryTaskStatusSyncCron, общий
// на оба направления, или ленивое достраивание при первом открытии отчёта),
// и ни одно из трёх событий с этим изменением не связано. Без этого штампа
// переход задачи в «Выполнено» не инвалидирует уже посчитанный кэш открытого
// периода — строка правила остаётся невидимой в отчёте до случайного
// совпадения с одним из трёх других источников (правка схемы, тик
// ERP-синка, правка плана продаж), что в dev (крон синка задач и ERP не
// тикает вне прода) может не произойти вообще.
export function taskCompletionFreshnessStamp(tasks: ShopSalaryTask[]): string {
    const latest = tasks.reduce<Date | null>(
        (max, task) => (!max || task.updatedAt > max ? task.updatedAt : max),
        null,
    );
    return AccountingCacheFreshness.dateStamp(latest);
}
