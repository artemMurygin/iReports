import { Inject, Injectable } from '@nestjs/common';
import { CommandBus } from '@nestjs/cqrs';
import {
    ArgumentInvalidException,
    NotFoundException,
} from '@/shared/exceptions';
import { Period } from '@/shared/domain/period.value-object';
import { SHOP_SALARY_RULE_REPOSITORY } from '@/domains/shop/modules/accounting/application/ports/motivation-schema/salary-rule.port';
import type { ShopSalaryRuleRepositoryPort } from '@/domains/shop/modules/accounting/application/ports/motivation-schema/salary-rule.port';
import { CreateTaskCommand } from '@/modules/tasks/application/command/create-task/create-task.command';
import type {
    ShopSalaryRule,
    TaskCompletionShopSalaryConfig,
} from '@/domains/shop/modules/accounting/domain/types/salary-rule.types';
import { computeRecurringTaskDeadline } from '@/domains/shop/modules/accounting/domain/services/task-deadline';

// openspec/changes/replace-bitrix-task-integration, design.md решение 4 /
// architecture.md (EnsureRuleTaskForPeriodService) — зеркало одноимённого
// сервиса направления service (issue #57 — независимая копия), по прямому
// образцу EnsureSalesPlansForPeriodService/SalesPlanAutoCreationCron.
// Переехал сюда, в accounting, из tasks (design.md решение 1/4) — именно
// потому что идемпотентность "одна задача на правило за период" теперь
// описывается картой в самом SalaryRule.config, которую знает только
// accounting; tasks про эту связь не знает вовсе.
//
// responsibleEmployeeId (assigneeEmployeeId) передаётся ВЫЗЫВАЮЩИМ кодом
// (report-сервисы уже знают сотрудника, для которого считают отчёт, см.
// CalculationEmployee.id в calculation-context.ts) — этот сервис не
// резолвит его сам.
//
// ⚠️ Открытый вопрос (унаследован из design.md Risks, не решён явно): если
// правило TaskCompletion заведено на схему ОТДЕЛА (а не личную), у него
// один и тот же salaryRuleId для всех сотрудников отдела — идемпотентность
// по (salaryRuleId, period) в config.taskIdByPeriod физически допускает
// только ОДНУ задачу на правило за период, значит только ПЕРВЫЙ
// обработанный сотрудник станет реальным assigneeEmployeeId; остальные
// обращения ensure() для того же правила в этом периоде просто найдут уже
// существующую запись (идемпотентно, без ошибки), но с "чужим"
// ответственным.
//
// spec: shop/accounting#requirement-разовое-и-регулярное-правило-за-выполнение-задачи
@Injectable()
export class EnsureShopSalaryTaskForPeriodService {
    constructor(
        @Inject(SHOP_SALARY_RULE_REPOSITORY)
        private readonly ruleRepo: ShopSalaryRuleRepositoryPort,
        private readonly commandBus: CommandBus,
    ) {}

    async ensure(
        salaryRuleId: string,
        period: string,
        assigneeEmployeeId: number,
    ): Promise<string | null> {
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

        // Идемпотентность — карта config.taskIdByPeriod, а не отдельный
        // unique-индекс (design.md решение 2): запись за этот период уже
        // есть (в любом статусе) — не пересоздаём.
        const existingTaskId = config.taskIdByPeriod[period];
        if (existingTaskId) {
            return existingTaskId;
        }

        // Разовое правило создаёт РОВНО одну задачу — при создании самого
        // правила (TaskCompletionShop.create(), не через ensure()). Если к
        // этому моменту записи за period нет (проверено выше), значит
        // запрошенный period — не период создания разового правила.
        if (!config.isRecurring) {
            return null;
        }

        const periodVO = Period.create(period);
        const deadline = computeRecurringTaskDeadline(
            periodVO,
            config.deadlineTemplate,
        );

        // Единственное оставшееся межмодульное обращение accounting → tasks
        // (design.md решение 4) — публичный use-case tasks через общий
        // CommandBus, тот же, что и HTTP POST /v1/tasks, не приватный
        // "бэкдор" для accounting.
        const { id: taskId } = await this.commandBus.execute<
            CreateTaskCommand,
            { id: string }
        >(
            new CreateTaskCommand({
                title: config.taskTitleTemplate,
                description: config.taskDescriptionTemplate,
                deadline,
                assigneeEmployeeId,
                direction: 'shop',
            }),
        );

        // Свежий объект, структурно удовлетворяющий ShopSalaryRule (а не
        // мутация уже полученного rule "на месте") — тот же приём, что и у
        // ShopSalaryRuleFactory.restore()/mapper.toDomain(): repository.
        // update() читает только id/type/name/targetRole/config через
        // ShopSalaryRuleMapper.toPersistence(), поэтому плоский объект
        // достаточен и не зависит от того, какой конкретный класс вернул
        // findById().
        const updatedRule: ShopSalaryRule = {
            id: rule.id,
            name: rule.name,
            type: rule.type,
            targetRole: rule.targetRole,
            config: {
                ...config,
                taskIdByPeriod: { ...config.taskIdByPeriod, [period]: taskId },
            },
            updatedAt: rule.updatedAt,
            calculate: (context) => rule.calculate(context),
        };
        await this.ruleRepo.update(updatedRule);

        return taskId;
    }
}

// Экспортируется для переиспользования вызывающими
// (GetShopEmployeeSalaryReportService/GetShopDepartmentSalaryReportService)
// — единое определение "какие правила ensure() вообще касается", чтобы
// места не разошлись в критерии фильтрации (зеркало
// filterRecurringTaskCompletionRules направления service).
export function filterRecurringTaskCompletionShopRules(
    rules: ShopSalaryRule[],
): ShopSalaryRule[] {
    return rules.filter(
        (rule) =>
            rule.type === 'TaskCompletion' &&
            (rule.config as TaskCompletionShopSalaryConfig).isRecurring,
    );
}
