import { randomUUID } from 'crypto';
import { AggregateID, Entity } from '@/shared/domain/entity.base';
import { CalculationLine } from '@/shared/domain/calculation-line';
import { Period } from '@/shared/domain/period.value-object';
import {
    CreateShopSalaryRuleProps,
    ShopSalaryRule,
    TargetRole,
    TaskCompletionShopSalaryConfig,
    TaskCompletionShopSalaryRule,
} from '@/domains/shop/modules/accounting/domain/types/salary-rule.types';
import type { ShopCalculationContext } from '@/domains/shop/modules/accounting/domain/types/calculation-context.types';
import type { ShopCalculationErpData } from '@/domains/shop/modules/accounting/domain/types/calculation-data.types';

// openspec/changes/replace-bitrix-task-integration — зеркало TaskCompletion
// сервиса (domains/service/modules/accounting/domain/entities/salary-rules/
// task-completion.entity.ts), независимая копия для направления shop
// (issue #57 — не переиспользует ни один класс сервиса).
//
// spec: shop/accounting#requirement-строка-правила-за-выполнение-задачи-появляется-сразу-и-растёт-по-статусу-задачи
// (task-completion-progressive-visibility — пересматривает прежнее решение
// «не видно в прогнозе до выполнения»)
//
// В отличие от остальных типов правил магазина (ProductSold/
// UsedProductSold/PayPerHour), TaskCompletionShop не матчит сотрудника по
// полям ERP-данных — правило целиком привязано к ОДНОМУ конкретному
// сотруднику через его мотивационную схему, поэтому calculate() не
// фильтрует erpData по роли, а лишь смотрит статус СВОЕЙ связанной задачи
// по ключу this.id в erpData.taskCompletionStatuses (заполняется
// task-completion-statuses.builder.ts, design.md решение 5).
export class TaskCompletionShop
    extends Entity<TaskCompletionShopSalaryRule>
    implements ShopSalaryRule
{
    declare protected _id: AggregateID;

    get name(): string {
        return this.props.name;
    }

    get type(): string {
        return this.props.type;
    }

    get targetRole(): TargetRole {
        return this.props.targetRole;
    }

    get config(): TaskCompletionShopSalaryConfig {
        return this.props.config;
    }

    // design.md решение 4 — CreateShopSalaryRuleHandler больше не ходит в
    // Bitrix/tasks вообще: taskId приходит в теле запроса как часть
    // config (contracts: TaskCompletionShopSalaryConfigRequest,
    // taskIdByPeriod не выставляется наружу как редактируемое поле формы) и
    // здесь же, в фабрике правила, сохраняется как
    // config.taskIdByPeriod[текущийПериод] — ОДИН, уже существующий
    // локальный insert(rule), без похода в tasks/Bitrix и без отдельной
    // транзакции (см. WHY у CreateShopSalaryRuleHandler).
    static create(rule: CreateShopSalaryRuleProps): TaskCompletionShop {
        return new TaskCompletionShop({
            id: randomUUID(),
            props: {
                name: rule.name,
                type: 'TaskCompletion',
                targetRole: rule.targetRole,
                config: TaskCompletionShop.buildConfig(rule.config, {}),
            },
        });
    }

    // PATCH .../motivation-schema/:id (UpdateShopMotivationSchemaHandler) —
    // правило, СОВПАВШЕЕ по id со старым (то же самое правило,
    // отредактированное на месте, не пересозданное заново): в отличие от
    // ShopSalaryRuleFactory.restore(), используемого остальными типами
    // правил (запрос и персистентная форма конфига у них совпадают),
    // TaskCompletion обязан ЯВНО слить новый taskId (текущего периода) с
    // УЖЕ существующей картой taskIdByPeriod прежних периодов — иначе
    // правка правила стирала бы историю задач прошлых периодов регулярного
    // правила (design.md решение 2: "правило хранит связь само").
    static restore(
        id: string,
        rule: CreateShopSalaryRuleProps,
        existing: TaskCompletionShop,
    ): TaskCompletionShop {
        return new TaskCompletionShop({
            id,
            props: {
                name: rule.name,
                type: 'TaskCompletion',
                targetRole: rule.targetRole,
                config: TaskCompletionShop.buildConfig(
                    rule.config,
                    existing.config.taskIdByPeriod,
                ),
            },
        });
    }

    private static buildConfig(
        requestConfig: unknown,
        existingTaskIdByPeriod: Record<string, string>,
    ): TaskCompletionShopSalaryConfig {
        // rule.config приходит в форме wire-запроса
        // (TaskCompletionShopSalaryConfigRequest из ireports-contracts:
        // {taskId, taskTitleTemplate, taskDescriptionTemplate?, isRecurring,
        // deadlineTemplate, defaultAmount}) — единственное место, где домен
        // TaskCompletionShop транслирует её в персистентную/доменную форму
        // (taskIdByPeriod вместо одиночного taskId).
        const config = requestConfig as {
            taskId: string;
            taskTitleTemplate: string;
            taskDescriptionTemplate?: string;
            isRecurring: boolean;
            deadlineTemplate: string;
            defaultAmount: number;
            taskLinkTemplates?: { url: string; label?: string }[];
        };
        const period = Period.current().getValue();

        return {
            taskIdByPeriod: {
                ...existingTaskIdByPeriod,
                [period]: config.taskId,
            },
            taskTitleTemplate: config.taskTitleTemplate,
            taskDescriptionTemplate: config.taskDescriptionTemplate,
            isRecurring: config.isRecurring,
            deadlineTemplate: config.deadlineTemplate,
            defaultAmount: config.defaultAmount,
            taskLinkTemplates: config.taskLinkTemplates ?? [],
        };
    }

    // spec: shop/accounting#requirement-сумма-начисления-по-правилу-за-выполнение-задачи-задаётся-руководителем-вручную
    //
    // Implements FR1-FR3 of task-completion-progressive-visibility: null
    // остаётся только когда задача этого периода вообще не заведена — раз
    // заведена, строка присутствует в ОБОИХ проходах (FACT/PROGNOSE).
    // PROGNOSE = config.defaultAmount СРАЗУ, вне зависимости от статуса
    // задачи. FACT = 0, пока задача не достигла статуса «Выполнена»
    // (ShopSalaryTask.isFactAccrued(), не запросом к tasks из самого
    // правила, см. backend/CLAUDE.md — domain не имеет доступа к IO; сумма
    // не откатывается автоматически при доработке/неуспешном закрытии).
    // requiresManualInput ВСЕГДА true — при закрытии периода руководитель
    // по-прежнему обязан подтвердить сумму и вправе уменьшить её с
    // обязательным комментарием, если по факту сделано меньше: действующая
    // сумма живёт только на ShopSalaryAccrualLine (design.md Decision 5),
    // calculate() её не читает и не пересчитывает.
    calculate(context: ShopCalculationContext): CalculationLine | null {
        const erpData = context.erpData as ShopCalculationErpData | undefined;
        const salaryTask = erpData?.taskCompletionStatuses?.[this.id];

        if (!salaryTask) {
            return null;
        }

        const amount =
            context.mode === 'FACT'
                ? salaryTask.isFactAccrued()
                    ? this.props.config.defaultAmount
                    : 0
                : this.props.config.defaultAmount;

        return {
            ruleId: this.id,
            amount,
            requiresManualInput: true,
            sources: this.buildSources(salaryTask.taskId),
        };
    }

    // spec: shop/accounting#requirement-детализация-строки-задача-и-ссылка-на-неё
    //
    // label — config.taskTitleTemplate (единственный локально известный
    // заголовок; сама первая задача создана с произвольным заголовком до
    // появления правила, см. WHY у TaskCompletionShopSalaryConfig — этот же
    // компромисс принят design.md решением 4 для авто-пересоздания).
    // link — внутренняя страница задачи iReports (модуль tasks), не Bitrix24
    // (интеграция удалена целиком, design.md решение 1).
    private buildSources(taskId: string) {
        return [
            {
                type: 'taskCompletion',
                id: taskId,
                label: this.props.config.taskTitleTemplate,
                link: `/tasks/${taskId}`,
            },
        ];
    }

    validate(): void {}
}
