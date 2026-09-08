import type { SalaryRule } from '@/domains/service/modules/accounting/domain/types/salary-rule.types';
import type { SalaryTaskRepositoryPort } from '@/domains/service/modules/accounting/application/ports/salary-task/salary-task.port';
import type { ServiceCalculationErpData } from '@/domains/service/modules/accounting/domain/types/calculation-data.types';
import type { SalaryTask } from '@/domains/service/modules/accounting/domain/entities/salary-task/salary-task.entity';
import { AccountingCacheFreshness } from '@/domains/service/modules/accounting/domain/services/accounting-cache-freshness';

// Раздел 12 tasks.md (add-task-based-salary-rule) — заполняет
// erpData.taskCompletionStatuses (calculation-data.types.ts) статусами
// SalaryTask ТЕКУЩЕГО периода для всех TaskCompletion-правил переданной
// схемы/набора правил. Переиспользуется в двух местах, у которых нет
// общего родителя: BuildServiceCalculationContextService (отчёт
// сотрудника, Фаза 7) и GetDepartmentSalaryReportService (батч на отдел,
// erpData которого собирается вручную, без контекст-билдера, см. WHY в
// самом сервисе) — вынесено сюда как самостоятельная функция, а не метод
// одного из двух сервисов, чтобы не плодить зависимость одного от другого.
//
// Правило не ходит в БД само (см. calculation-context.ts) — этот
// application-сервис единственный, кто читает SalaryTaskRepositoryPort ради
// заполнения контекста; TaskCompletion.calculate() лишь читает готовую
// карту по своему this.id.
// Общая часть buildTaskCompletionStatuses/taskCompletionFreshnessStamp ниже
// — оба хотят один и тот же список SalaryTask (правило → задача текущего
// периода), но по разным причинам (карта для расчёта / штамп для инвалидации
// кэша, см. WHY у taskCompletionFreshnessStamp), поэтому запрос вынесен сюда
// один раз вместо дублирования в обеих функциях.
export async function findTaskCompletionTasks(
    taskRepo: SalaryTaskRepositoryPort,
    rules: SalaryRule[],
    period: string,
): Promise<SalaryTask[]> {
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
    taskRepo: SalaryTaskRepositoryPort,
    rules: SalaryRule[],
    period: string,
): Promise<NonNullable<ServiceCalculationErpData['taskCompletionStatuses']>> {
    const tasks = await findTaskCompletionTasks(taskRepo, rules, period);
    return taskCompletionStatusesFromTasks(tasks);
}

export function taskCompletionStatusesFromTasks(
    tasks: SalaryTask[],
): NonNullable<ServiceCalculationErpData['taskCompletionStatuses']> {
    const statuses: NonNullable<
        ServiceCalculationErpData['taskCompletionStatuses']
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
// salesPlan) не знают про SalaryTask — статус связанной задачи
// TaskCompletion-правила меняется отдельно (SalaryTaskStatusSyncCron, раздел
// 8, или ленивое достраивание при первом открытии отчёта), и ни одно из
// трёх событий с этим изменением не связано. Без этого штампа переход
// задачи в «Выполнено» не инвалидирует уже посчитанный кэш открытого
// периода — строка правила остаётся невидимой в отчёте (см.
// requirement-правило-за-выполнение-задачи-не-видно-в-прогнозе-до-выполнения)
// до случайного совпадения с одним из трёх других источников (правка схемы,
// тик ERP-синка, правка плана продаж), что в dev (крон синка задач и ERP не
// тикает вне прода) может не произойти вообще.
export function taskCompletionFreshnessStamp(tasks: SalaryTask[]): string {
    const latest = tasks.reduce<Date | null>(
        (max, task) => (!max || task.updatedAt > max ? task.updatedAt : max),
        null,
    );
    return AccountingCacheFreshness.dateStamp(latest);
}
