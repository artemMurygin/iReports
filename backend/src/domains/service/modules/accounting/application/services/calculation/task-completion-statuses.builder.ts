import type {
    SalaryRule,
    TaskCompletionSalaryConfig,
} from '@/domains/service/modules/accounting/domain/types/salary-rule.types';
import type { TaskRepositoryPort } from '@/modules/tasks/application/ports/task.repository.port';
import type { Task } from '@/modules/tasks/domain/entities/task.entity';
import type { ServiceCalculationErpData } from '@/domains/service/modules/accounting/domain/types/calculation-data.types';
import { SalaryTask } from '@/domains/service/modules/accounting/domain/entities/salary-task/salary-task.entity';
import { AccountingCacheFreshness } from '@/domains/service/modules/accounting/domain/services/accounting-cache-freshness';

// replace-bitrix-task-integration, design.md решение 5 — заполняет
// erpData.taskCompletionStatuses (calculation-data.types.ts) статусами
// SalaryTask ТЕКУЩЕГО периода для всех TaskCompletion-правил переданной
// схемы/набора правил. Переиспользуется в двух местах, у которых нет
// общего родителя: BuildServiceCalculationContextService (отчёт сотрудника)
// и GetDepartmentSalaryReportService (батч на отдел, erpData которого
// собирается вручную, без контекст-билдера, см. WHY в самом сервисе) —
// вынесено сюда как самостоятельная функция, а не метод одного из двух
// сервисов, чтобы не плодить зависимость одного от другого.
//
// Правило не ходит в БД само (см. calculation-context.ts) — этот
// application-сервис ЕДИНСТВЕННЫЙ, кто читает TASK_REPOSITORY напрямую (без
// Port/Adapter поверх, design.md решение 5) ради заполнения контекста;
// TaskCompletion.calculate() лишь читает готовую карту по своему this.id.

// Связка «правило → его задача текущего периода», уже найденная в
// TASK_REPOSITORY — единственная точка, где известна пара (ruleId, Task):
// сама Task (модуль tasks) о правилах не знает вообще (design.md решение
// 2), поэтому обратная связь "какому правилу принадлежит эта Task"
// восстанавливается только здесь, по config.taskIdByPeriod[period].
export interface TaskCompletionRuleTask {
    ruleId: string;
    task: Task;
}

export async function findTaskCompletionTasks(
    taskRepo: TaskRepositoryPort,
    rules: SalaryRule[],
    period: string,
): Promise<TaskCompletionRuleTask[]> {
    const refs: { ruleId: string; taskId: string }[] = [];
    for (const rule of rules) {
        if (rule.type !== 'TaskCompletion') {
            continue;
        }
        const taskId = (rule.config as TaskCompletionSalaryConfig)
            .taskIdByPeriod[period];
        // Правило без записи за этот период — эквивалент прежнего «задача
        // не заведена» (design.md решение 5).
        if (taskId) {
            refs.push({ ruleId: rule.id, taskId });
        }
    }

    // Ни одного TaskCompletion-правила с задачей за этот период — не делаем
    // лишний запрос в БД (тот же приём, что и batch-методы
    // ServiceCalculationDataPort с пустым списком).
    if (refs.length === 0) {
        return [];
    }

    const tasks = await taskRepo.findManyByIds(refs.map((ref) => ref.taskId));
    const tasksById = new Map(tasks.map((task) => [task.id, task]));

    const result: TaskCompletionRuleTask[] = [];
    for (const ref of refs) {
        const task = tasksById.get(ref.taskId);
        // Ссылка на несуществующий/удалённый taskId (design.md Risks:
        // «сама себя проявит на первом же расчёте отчёта») — правило
        // просто не попадает в результат, тот же код пути, что и «задача не
        // заведена».
        if (task) {
            result.push({ ruleId: ref.ruleId, task });
        }
    }
    return result;
}

export async function buildTaskCompletionStatuses(
    taskRepo: TaskRepositoryPort,
    rules: SalaryRule[],
    period: string,
): Promise<NonNullable<ServiceCalculationErpData['taskCompletionStatuses']>> {
    const refs = await findTaskCompletionTasks(taskRepo, rules, period);
    return taskCompletionStatusesFromTasks(refs);
}

export function taskCompletionStatusesFromTasks(
    refs: TaskCompletionRuleTask[],
): NonNullable<ServiceCalculationErpData['taskCompletionStatuses']> {
    const statuses: NonNullable<
        ServiceCalculationErpData['taskCompletionStatuses']
    > = {};
    for (const { ruleId, task } of refs) {
        statuses[ruleId] = SalaryTask.create({
            taskId: task.id,
            status: task.status.code,
        });
    }
    return statuses;
}

// AccountingCacheFreshness'а три источника инвалидации (schema/domainSync/
// salesPlan) не знают про Task — статус связанной задачи TaskCompletion-
// правила меняется отдельно (переход статуса ответственным/руководителем
// через HTTP tasks), и ни одно из трёх событий с этим изменением не
// связано. Без этого штампа переход задачи в «Закрыта успешно» не
// инвалидирует уже посчитанный кэш открытого периода — строка правила
// остаётся невидимой в отчёте (см.
// requirement-правило-за-выполнение-задачи-не-видно-в-прогнозе-до-выполнения)
// до случайного совпадения с одним из трёх других источников.
export function taskCompletionFreshnessStamp(
    refs: TaskCompletionRuleTask[],
): string {
    const latest = refs.reduce<Date | null>(
        (max, { task }) =>
            !max || task.updatedAt > max ? task.updatedAt : max,
        null,
    );
    return AccountingCacheFreshness.dateStamp(latest);
}
