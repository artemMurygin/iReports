import { Inject, Injectable } from '@nestjs/common';
import { CommandBus } from '@nestjs/cqrs';
import { ArgumentInvalidException } from '@/shared/exceptions';
import { Period } from '@/shared/domain/period.value-object';
import { CreateTaskCommand } from '@/modules/tasks/application/command/create-task/create-task.command';
import { SALARY_RULE_REPOSITORY } from '@/domains/service/modules/accounting/application/ports/motivation-schema/salary-rule.port';
import type { SalaryRuleRepositoryPort } from '@/domains/service/modules/accounting/application/ports/motivation-schema/salary-rule.port';
import type {
    SalaryRule,
    TaskCompletionSalaryConfig,
} from '@/domains/service/modules/accounting/domain/types/salary-rule.types';

// replace-bitrix-task-integration, design.md решение 4 — заменяет прежний
// EnsureSalaryTaskForPeriodService (Bitrix-based): для регулярного правила
// TaskCompletion, на новый расчётный период, идемпотентно возвращает
// существующий или создаёт новый taskId. В отличие от прежней версии,
// ЖИВЁТ в accounting (а не в tasks) и работает с уже РЕЗОЛВЛЕННЫМ
// SalaryRule (не ходит в SALARY_RULE_REPOSITORY за ним сама) — идемпотентность
// «одна задача на правило за период» теперь описывается картой в самом
// SalaryRule.config, которую знает только accounting.
//
// Создание новой задачи — ЕДИНСТВЕННОЕ оставшееся межмодульное обращение
// accounting → tasks (design.md решение 4): через общий CommandBus
// (CreateTaskCommand), тот же публичный use-case, что и HTTP `POST
// /v1/tasks`, а не приватный сервис/бэкдор только для accounting.
//
// ⚠️ Открытый вопрос (унаследован без изменений от прежней Bitrix-эры,
// design.md явно его не пересматривает): если правило TaskCompletion
// заведено на схему ОТДЕЛА, у него один и тот же salaryRuleId для всех
// сотрудников отдела — config.taskIdByPeriod физически допускает только
// ОДНУ задачу на правило за период, значит только ПЕРВЫЙ обработанный
// сотрудник станет реальным assigneeEmployeeId; остальные обращения
// ensure() для того же правила/периода просто найдут уже существующую
// запись (идемпотентно, без ошибки), но с "чужим" ответственным.
// CreateSalaryRuleHandler по-прежнему отклоняет создание TaskCompletion на
// схему отдела (см. TaskCompletionRequiresPersonalSchemaException) — это
// затрагивает только уже существующие (созданные до этого ограничения)
// правила отдела, если такие есть на практике.
@Injectable()
export class EnsureRuleTaskForPeriodService {
    constructor(
        @Inject(SALARY_RULE_REPOSITORY)
        private readonly ruleRepo: SalaryRuleRepositoryPort,
        private readonly commandBus: CommandBus,
    ) {}

    async ensure(
        rule: SalaryRule,
        period: string,
        assigneeEmployeeId: number,
    ): Promise<string | null> {
        if (rule.type !== 'TaskCompletion') {
            throw new ArgumentInvalidException(
                `Правило ${rule.id} не является TaskCompletion (тип: ${rule.type})`,
            );
        }
        const config = rule.config as TaskCompletionSalaryConfig;

        const existingTaskId = config.taskIdByPeriod[period];
        if (existingTaskId) {
            return existingTaskId;
        }

        // spec: service/accounting — разовое правило не пересоздаётся.
        // Задача разового правила заводится один раз, вручную, в момент
        // создания самого правила (CreateSalaryRuleHandler) — если для
        // ЗАПРОШЕННОГО периода записи нет, это просто не тот период, когда
        // правило было создано; новую задачу заводить не нужно.
        if (!config.isRecurring) {
            return null;
        }

        const deadline = computeDeadlineForPeriod(
            config.deadlineTemplate,
            period,
        );

        const { id: taskId } = await this.commandBus.execute<
            CreateTaskCommand,
            { id: string }
        >(
            new CreateTaskCommand({
                title: config.taskTitleTemplate,
                description: config.taskDescriptionTemplate,
                deadline,
                assigneeEmployeeId,
                direction: 'service',
            }),
        );

        // Мутация config напрямую (тот же объект, что и rule.config, см.
        // TaskCompletion.config getter) + локальный update(rule) —
        // единственная запись, не общая транзакция с tasks (design.md
        // решение 4).
        config.taskIdByPeriod[period] = taskId;
        await this.ruleRepo.update(rule);

        return taskId;
    }
}

// deadlineTemplate регулярного правила несёт только число месяца (и время
// суток, если руководитель его задал) — календарный год/месяц всегда
// берутся из запрошенного периода. День зажимается длиной целевого месяца
// (Period.getTotalCalendarDays()), чтобы, например, deadlineTemplate «31
// число» не выходил за пределы февраля.
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

// Экспортируется для переиспользования вызывающими
// (GetEmployeeSalaryReportService/GetDepartmentSalaryReportService) — единое
// определение "какие правила ensure() вообще касается", чтобы оба места не
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
