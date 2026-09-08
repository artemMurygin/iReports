import { Inject, Injectable } from '@nestjs/common';
import {
    ArgumentInvalidException,
    NotFoundException,
} from '@/shared/exceptions';
import { Period } from '@/shared/domain/period.value-object';
import { BITRIX_TASK_STATUS_NEW } from '@/integrations/bitrix/schema';
import { BITRIX_TASKS_GATEWAY } from '@/integrations/bitrix/ports/bitrix-tasks-gateway.port';
import type { BitrixTasksGatewayPort } from '@/integrations/bitrix/ports/bitrix-tasks-gateway.port';
import { SALARY_TASK_REPOSITORY } from '@/domains/service/modules/accounting/application/ports/salary-task/salary-task.port';
import type { SalaryTaskRepositoryPort } from '@/domains/service/modules/accounting/application/ports/salary-task/salary-task.port';
import { SALARY_RULE_REPOSITORY } from '@/domains/service/modules/accounting/application/ports/motivation-schema/salary-rule.port';
import type { SalaryRuleRepositoryPort } from '@/domains/service/modules/accounting/application/ports/motivation-schema/salary-rule.port';
import { SalaryTask } from '@/domains/service/modules/accounting/domain/entities/salary-task/salary-task.entity';
import { TaskStatus } from '@/domains/service/modules/accounting/domain/value-objects/task-status.value-object';
import type {
    SalaryRule,
    TaskCompletionSalaryConfig,
} from '@/domains/service/modules/accounting/domain/types/salary-rule.types';

// Раздел 11 tasks.md (add-task-based-salary-rule), design.md Decision 4 —
// по прямому образцу EnsureSalesPlansForPeriodService (domains/service/
// modules/sales/application/services/), но идемпотентность ключуется по
// ОДНОМУ правилу (salaryRuleId, period), а не по совокупности scope-ключей
// department/category: у SalaryTask свой естественный ключ (@@unique в
// salary-task.prisma, задача 1.1), и ровно одна запись — то, что нужно
// заполнить/пересоздать за вызов, в отличие от достраивания сразу всех
// строк периода у планов продаж.
//
// responsibleBitrixUserId передаётся ВЫЗЫВАЮЩИМ кодом (report-сервисы уже
// знают Bitrix-сотрудника, для которого считают отчёт — см.
// CalculationEmployee.id в calculation-context.ts, единственный источник
// истины о человеке в расчёте), а не резолвится здесь: этот сервис не
// инжектит ни MotivationSchemaRepository, ни справочник сотрудников — по
// заданию раздела 11, SALARY_RULE_REPOSITORY нужен только для чтения
// TaskCompletionSalaryConfig конкретного правила, не для обхода схем.
//
// ⚠️ Открытый вопрос (не решён design.md/tasks.md явно): если правило
// TaskCompletion заведено на схему ОТДЕЛА (а не личную), у него один и тот
// же salaryRuleId для всех сотрудников отдела — уникальный индекс
// (salaryRuleId, period) физически допускает только ОДНУ задачу Bitrix24 на
// правило за период, значит только ПЕРВЫЙ обработанный сотрудник станет
// реальным RESPONSIBLE_ID; остальные обращения ensure() для того же правила
// в этом периоде просто найдут уже существующую запись (идемпотентно, без
// ошибки), но с "чужим" ответственным. Решение оставлено как есть — задача
// не даёт основания предполагать иное, и наблюдаемое поведение (правило
// физически ссылается ровно на одну задачу) уже зафиксировано схемой БД;
// затронуто только department-scoped TaskCompletion, если он вообще
// используется на практике.
@Injectable()
export class EnsureSalaryTaskForPeriodService {
    constructor(
        @Inject(SALARY_TASK_REPOSITORY)
        private readonly taskRepo: SalaryTaskRepositoryPort,
        @Inject(BITRIX_TASKS_GATEWAY)
        private readonly tasksGateway: BitrixTasksGatewayPort,
        @Inject(SALARY_RULE_REPOSITORY)
        private readonly ruleRepo: SalaryRuleRepositoryPort,
    ) {}

    async ensure(
        salaryRuleId: string,
        period: string,
        responsibleBitrixUserId: number,
    ): Promise<SalaryTask | null> {
        const existing = await this.taskRepo.findByRuleAndPeriod(
            salaryRuleId,
            period,
        );
        if (existing) {
            return existing;
        }

        const rule = await this.ruleRepo.findById(salaryRuleId);
        if (!rule) {
            throw new NotFoundException(
                `Зарплатное правило ${salaryRuleId} не найдено`,
            );
        }
        if (rule.type !== 'TaskCompletion') {
            throw new ArgumentInvalidException(
                `Правило ${salaryRuleId} не является TaskCompletion (тип: ${rule.type})`,
            );
        }
        const config = rule.config as TaskCompletionSalaryConfig;

        // spec: service/accounting — разовая задача не пересоздаётся.
        // Задача разового правила заводится один раз в момент создания
        // самого правила (раздел 12, CreateSalaryRuleHandler), с периодом
        // создания. Если для ЗАПРОШЕННОГО периода записи нет — это просто
        // не тот период, когда правило было создано; новую задачу заводить
        // не нужно (и незачем — разовая задача не привязана к текущему
        // расчётному месяцу).
        if (!config.isRecurring) {
            return null;
        }

        const deadline = computeDeadlineForPeriod(
            config.deadlineTemplate,
            period,
        );

        const { bitrixTaskId } = await this.tasksGateway.createTask({
            responsibleBitrixUserId,
            title: config.bitrixTaskTitle,
            description: config.taskDescription,
            deadline,
        });

        const task = SalaryTask.create({
            salaryRuleId,
            period,
            deadline,
            isRecurring: true,
            bitrixTaskId,
            // Bitrix24 не возвращает статус на tasks.task.add как отдельное
            // повторно валидируемое поле, нужное здесь — задаём известный
            // статус новой задачи "Новая" (STATUS = 2, см.
            // BITRIX_TASK_STATUS_NEW) как первичное значение;
            // SalaryTaskStatusSyncCron (раздел 8) освежит его реальным
            // значением на ближайшем тике.
            taskStatus: TaskStatus.fromRaw(String(BITRIX_TASK_STATUS_NEW)),
        });

        // Последняя линия защиты от гонки параллельных вызовов (крон +
        // конкурентный ленивый триггер из отчёта) — @@unique в
        // salary-task.prisma, как и в EnsureSalesPlansForPeriodService; не
        // ловим её здесь тем же приёмом (см. WHY там).
        await this.taskRepo.insert(task);
        return task;
    }
}

// Раздел 11 tasks.md — deadlineTemplate регулярного правила несёт только
// число месяца (и время суток, если руководитель его задал) — календарный
// год/месяц всегда берутся из запрошенного периода. День зажимается длиной
// целевого месяца (Period.getTotalCalendarDays()), чтобы, например,
// deadlineTemplate "31 число" не выходил за пределы февраля.
export function computeDeadlineForPeriod(
    deadlineTemplate: string,
    period: string,
): Date {
    const template = new Date(deadlineTemplate);
    const [year, month] = period.split('-').map(Number);
    const totalDays = Period.create(period).getTotalCalendarDays();
    const day = Math.min(template.getUTCDate(), totalDays);

    return new Date(
        Date.UTC(
            year,
            month - 1,
            day,
            template.getUTCHours(),
            template.getUTCMinutes(),
            template.getUTCSeconds(),
            template.getUTCMilliseconds(),
        ),
    );
}

// Экспортируется для переиспользования вызывающими (GetEmployeeSalaryReportService/
// GetDepartmentSalaryReportService/TaskCompletionAutoCreationCron) — единое
// определение "какие правила ensure() вообще касается", чтобы три места не
// разошлись в критерии фильтрации.
export function filterRecurringTaskCompletionRules(
    rules: SalaryRule[],
): SalaryRule[] {
    return rules.filter(
        (rule) =>
            rule.type === 'TaskCompletion' &&
            (rule.config as TaskCompletionSalaryConfig).isRecurring,
    );
}

// Раздел 12 tasks.md — deadline самой первой задачи правила, заводимой
// CreateSalaryRuleHandler в момент создания правила (design.md Decision 6):
// та же развилка "буквально/только число месяца" (задача 2.1), что и
// deadlineTemplate вообще, но с deadline'ом ещё не существующей задачи, а
// не задачи следующего периода — computeDeadlineForPeriod переиспользуется
// без дублирования формулы клэмпа дня месяца, ensure() выше остаётся
// единственным местом, где она реализована.
export function resolveTaskDeadlineForCreation(
    config: TaskCompletionSalaryConfig,
    period: string,
): Date {
    return config.isRecurring
        ? computeDeadlineForPeriod(config.deadlineTemplate, period)
        : new Date(config.deadlineTemplate);
}
