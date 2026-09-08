import { Inject, Injectable } from '@nestjs/common';
import {
    ArgumentInvalidException,
    NotFoundException,
} from '@/shared/exceptions';
import { Period } from '@/shared/domain/period.value-object';
import { SHOP_SALARY_TASK_REPOSITORY } from '@/domains/shop/modules/accounting/application/ports/salary-task/salary-task.port';
import type { ShopSalaryTaskRepositoryPort } from '@/domains/shop/modules/accounting/application/ports/salary-task/salary-task.port';
import { SHOP_SALARY_RULE_REPOSITORY } from '@/domains/shop/modules/accounting/application/ports/motivation-schema/salary-rule.port';
import type { ShopSalaryRuleRepositoryPort } from '@/domains/shop/modules/accounting/application/ports/motivation-schema/salary-rule.port';
import { BITRIX_TASKS_GATEWAY } from '@/integrations/bitrix/ports/bitrix-tasks-gateway.port';
import type { BitrixTasksGatewayPort } from '@/integrations/bitrix/ports/bitrix-tasks-gateway.port';
import { ShopSalaryTask } from '@/domains/shop/modules/accounting/domain/entities/salary-task/salary-task.entity';
import { ShopTaskStatus } from '@/domains/shop/modules/accounting/domain/value-objects/task-status.value-object';
import type {
    ShopSalaryRule,
    TaskCompletionShopSalaryConfig,
} from '@/domains/shop/modules/accounting/domain/types/salary-rule.types';
import { computeRecurringTaskDeadline } from '@/domains/shop/modules/accounting/domain/services/task-deadline';

// Раздел 16 tasks.md (add-task-based-salary-rule), design.md Decision 4 —
// зеркало EnsureSalaryTaskForPeriodService направления service (раздел 11,
// issue #57 — независимая копия), по прямому образцу
// EnsureSalesPlansForPeriodService/SalesPlanAutoCreationCron. Идемпотентность
// ключуется по ОДНОМУ правилу (salaryRuleId, period) — у ShopSalaryTask
// свой естественный ключ (@@unique в salary-task.prisma, задача 1.1), а не
// по совокупности scope-ключей, как у планов продаж.
//
// responsibleBitrixUserId передаётся ВЫЗЫВАЮЩИМ кодом (report-сервисы уже
// знают Bitrix-сотрудника, для которого считают отчёт — см.
// CalculationEmployee.id в calculation-context.ts, единственный источник
// истины о человеке в расчёте), а не резолвится здесь — этот сервис не
// инжектит ShopMotivationSchemaRepository и не обходит схемы:
// SHOP_SALARY_RULE_REPOSITORY нужен только для чтения
// TaskCompletionShopSalaryConfig конкретного правила.
//
// ⚠️ Открытый вопрос (унаследован от зеркального сервиса направления
// service, не решён design.md/tasks.md явно): если правило TaskCompletion
// заведено на схему ОТДЕЛА (а не личную), у него один и тот же salaryRuleId
// для всех сотрудников отдела — уникальный индекс (salaryRuleId, period)
// физически допускает только ОДНУ задачу Bitrix24 на правило за период,
// значит только ПЕРВЫЙ обработанный сотрудник станет реальным
// RESPONSIBLE_ID; остальные обращения ensure() для того же правила в этом
// периоде просто найдут уже существующую запись (идемпотентно, без ошибки),
// но с "чужим" ответственным. Решение оставлено как есть, тем же приёмом,
// что и у зеркального сервиса — затронуто только department-scoped
// TaskCompletion, если он вообще используется на практике.
//
// spec: shop/accounting#requirement-разовое-и-регулярное-правило-за-выполнение-задачи
@Injectable()
export class EnsureShopSalaryTaskForPeriodService {
    constructor(
        @Inject(SHOP_SALARY_TASK_REPOSITORY)
        private readonly taskRepo: ShopSalaryTaskRepositoryPort,
        @Inject(BITRIX_TASKS_GATEWAY)
        private readonly bitrixTasksGateway: BitrixTasksGatewayPort,
        @Inject(SHOP_SALARY_RULE_REPOSITORY)
        private readonly ruleRepo: ShopSalaryRuleRepositoryPort,
    ) {}

    async ensure(
        salaryRuleId: string,
        period: string,
        responsibleBitrixUserId: number,
    ): Promise<ShopSalaryTask | null> {
        // Строка уже есть за этот период (в любом статусе) — не
        // пересоздаём: идемпотентность именно в этом. Уникальный индекс
        // (salaryRuleId, period) в Prisma — последняя линия защиты от
        // гонки параллельных вызовов (крон + ленивый триггер), отдельно её
        // здесь не ловим (тот же приём, что и в
        // EnsureShopSalesPlansForPeriodService/зеркальном сервисе
        // направления service).
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
        const config = rule.config as TaskCompletionShopSalaryConfig;

        // Разовое правило создаёт РОВНО одну задачу — при создании самого
        // правила (CreateShopSalaryRuleHandler, раздел 17), не через
        // ensure(). Если к этому моменту существующей записи за period нет
        // (проверено выше), значит запрошенный period — не период создания
        // разового правила: спека требует, что оно "больше не создаёт
        // новую задачу и не участвует в начислении следующего периода".
        if (!config.isRecurring) {
            return null;
        }

        const periodVO = Period.create(period);
        const deadline = computeRecurringTaskDeadline(
            periodVO,
            config.deadlineTemplate,
        );

        const { bitrixTaskId } = await this.bitrixTasksGateway.createTask({
            responsibleBitrixUserId,
            title: config.bitrixTaskTitle,
            description: config.taskDescription,
            deadline,
        });

        const task = ShopSalaryTask.create({
            salaryRuleId,
            period: periodVO,
            deadline,
            isRecurring: true,
            bitrixTaskId,
            taskStatus: ShopTaskStatus.newlyCreated(),
        });

        await this.taskRepo.insert(task);

        return task;
    }
}

// Раздел 16 tasks.md — экспортируется для переиспользования вызывающими
// (GetShopEmployeeSalaryReportService/GetShopDepartmentSalaryReportService/
// ShopTaskCompletionAutoCreationCron) — единое определение "какие правила
// ensure() вообще касается", чтобы три места не разошлись в критерии
// фильтрации (зеркало filterRecurringTaskCompletionRules направления
// service).
export function filterRecurringTaskCompletionShopRules(
    rules: ShopSalaryRule[],
): ShopSalaryRule[] {
    return rules.filter(
        (rule) =>
            rule.type === 'TaskCompletion' &&
            (rule.config as TaskCompletionShopSalaryConfig).isRecurring,
    );
}

// Раздел 17 tasks.md (add-task-based-salary-rule) — зеркало
// resolveTaskDeadlineForCreation направления service (раздел 12,
// application/services/salary-task/ensure-salary-task-for-period.service.ts,
// issue #57 — независимая копия). Дедлайн задачи, создаваемой ПРИ
// ЗАВЕДЕНИИ правила TaskCompletion (CreateShopSalaryRuleHandler, раздел
// 17) — в отличие от ensure() выше (только регулярные правила на СЛЕДУЮЩИЙ
// период), здесь правило может быть и разовым: deadlineTemplate берётся
// буквально (разовое) или переносится на день месяца текущего периода
// (регулярное, computeRecurringTaskDeadline) — та же развилка, что и в
// TaskCompletionShopSalaryConfig.deadlineTemplate (задача 15.3/2.1).
export function resolveTaskDeadlineForCreation(
    config: TaskCompletionShopSalaryConfig,
    period: string,
): Date {
    return config.isRecurring
        ? computeRecurringTaskDeadline(
              Period.create(period),
              config.deadlineTemplate,
          )
        : new Date(config.deadlineTemplate);
}
