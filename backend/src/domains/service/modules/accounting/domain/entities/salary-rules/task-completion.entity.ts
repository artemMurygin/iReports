import { randomUUID } from 'crypto';
import { AggregateID, Entity } from '@/shared/domain/entity.base';
import { CalculationContext } from '@/shared/domain/calculation-context';
import { CalculationLine } from '@/shared/domain/calculation-line';
import { Period } from '@/shared/domain/period.value-object';
import type { TaskCompletionSalaryConfigRequest } from 'ireports-contracts';
import {
    CreateSalaryRuleProps,
    SalaryRule,
    TargetRole,
    TaskCompletionSalaryConfig,
    TaskCompletionSalaryRule,
} from '@/domains/service/modules/accounting/domain/types/salary-rule.types';
import type { ServiceCalculationErpData } from '@/domains/service/modules/accounting/domain/types/calculation-data.types';

// replace-bitrix-task-integration, design.md решение 2/4/5: правило «за
// выполнение задачи» — единственный тип правила сервиса, чей calculate()
// может вернуть null (см. domain/types/salary-rule.types.ts,
// SalaryRule.calculate()), но ТОЛЬКО пока задача этого периода вообще не
// заведена — spec:
// service/accounting#requirement-строка-правила-за-выполнение-задачи-появляется-сразу-и-растёт-по-статусу-задачи
// (task-completion-progressive-visibility — пересматривает прежнее решение
// «не видно в прогнозе до выполнения»).
//
// Связанная задача (модуль src/modules/tasks) не хранится в props правила
// целиком и не читается репозиторием отсюда напрямую (правило не ходит в БД
// само, см. calculation-context.ts) — только её id, в
// config.taskIdByPeriod; статус приходит через
// context.erpData.taskCompletionStatuses (SalaryTask, построенная
// task-completion-statuses.builder.ts), заполняемый
// BuildServiceCalculationContextService по ruleId (this.id).
export class TaskCompletion
    extends Entity<TaskCompletionSalaryRule>
    implements SalaryRule
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

    get config(): TaskCompletionSalaryConfig {
        return this.props.config;
    }

    get isActive(): boolean {
        return this.props.isActive;
    }

    // design.md решение 4: приходящий в теле запроса taskId (id уже
    // существующей, отдельно созданной задачи) просто сохраняется в
    // config.taskIdByPeriod[текущийПериод] — CreateSalaryRuleHandler не
    // делает ни одного вызова в tasks.
    static create(rule: CreateSalaryRuleProps): TaskCompletion {
        return new TaskCompletion({
            id: randomUUID(),
            props: {
                name: rule.name,
                type: 'TaskCompletion',
                targetRole: rule.targetRole,
                config: buildTaskCompletionConfig(
                    rule.config as TaskCompletionSalaryConfigRequest,
                ),
                isActive: true,
            },
        });
    }

    // Soft-деактивация/реактивация (см. isActive у SalaryRule) — прямая
    // мутация props, тот же приём, что и MotivationSchema.rename().
    deactivate(): void {
        this.props.isActive = false;
    }

    activate(): void {
        this.props.isActive = true;
    }

    // spec: service/accounting#requirement-сумма-начисления-по-правилу-за-выполнение-задачи-задаётся-руководителем-вручную
    //
    // Implements FR1-FR3 of task-completion-progressive-visibility: null
    // остаётся только когда задача этого периода вообще не заведена (нет
    // записи в erpData.taskCompletionStatuses, см. builder) — раз задача
    // заведена, строка присутствует в ОБОИХ проходах (FACT/PROGNOSE).
    // PROGNOSE = config.defaultAmount СРАЗУ, вне зависимости от статуса
    // задачи (сотрудник видит ожидаемую сумму, как только задача
    // поставлена). FACT = 0, пока задача не достигла статуса «Выполнена»
    // (SalaryTask.isFactAccrued() — включает и более поздние статусы,
    // сумма не откатывается автоматически при доработке/неуспешном
    // закрытии). requiresManualInput ВСЕГДА true — при закрытии периода
    // руководитель по-прежнему обязан подтвердить сумму, и вправе уменьшить
    // её с обязательным комментарием, если по факту сделано меньше
    // (SetTaskCompletionLineReward); действующая сумма живёт только на
    // SalaryAccrualLine и не пересчитывается здесь (тот же принцип, что и
    // adjust() у других типов правил — не влияет на live-пересчёт открытого
    // периода).
    calculate(context: CalculationContext): CalculationLine | null {
        const erpData = context.erpData as
            ServiceCalculationErpData | undefined;

        const entry = erpData?.taskCompletionStatuses?.[this.id];
        if (!entry) {
            return null;
        }

        const amount =
            context.mode === 'FACT'
                ? entry.isFactAccrued()
                    ? this.props.config.defaultAmount
                    : 0
                : this.props.config.defaultAmount;

        return {
            ruleId: this.id,
            amount,
            requiresManualInput: true,
            sources: this.buildSources(entry.taskId),
        };
    }

    // Задача больше не живёт во внешней ERP (см. proposal.md → Why) —
    // источник строки несёт только id связанной задачи, без
    // человекочитаемого номера документа/ссылки в ERP (см.
    // calculation-line.ts, CalculationSourceRef.label/link — опциональны
    // именно для источников без такого документа, у 'taskCompletion'
    // сегодня их нет).
    private buildSources(taskId: string) {
        return [
            {
                type: 'taskCompletion',
                id: taskId,
            },
        ];
    }

    validate(): void {}
}

// Собирает домен-config из request-config — вызывается и TaskCompletion.create()
// (существующий taskIdByPeriod ещё не заведён), и UpdateMotivationSchemaHandler
// при правке уже существующего правила (existingTaskIdByPeriod — карта
// прежнего правила, чтобы PATCH не терял привязку задач прошлых периодов
// регулярного правила, см. design.md решение 4 — taskId запроса относится
// только к ТЕКУЩЕМУ периоду).
export function buildTaskCompletionConfig(
    request: TaskCompletionSalaryConfigRequest,
    existingTaskIdByPeriod: Record<string, string> = {},
): TaskCompletionSalaryConfig {
    // add-task-salary-rule-accounting-period, design.md решение 2 — период
    // больше не вычисляется скрыто как Period.current(), а приходит из
    // запроса (руководитель выбирает его осознанно в форме); Period.create()
    // здесь — валидация формата на границе домена, а не только Zod-схемой
    // контракта (бросает ArgumentInvalidException при некорректном значении).
    const accountingPeriod = Period.create(request.accountingPeriod).getValue();

    return {
        taskIdByPeriod: {
            ...existingTaskIdByPeriod,
            [accountingPeriod]: request.taskId,
        },
        taskTitleTemplate: request.taskTitleTemplate,
        taskDescriptionTemplate: request.taskDescriptionTemplate,
        isRecurring: request.isRecurring,
        deadlineTemplate: request.deadlineTemplate,
        defaultAmount: request.defaultAmount,
        taskLinkTemplates: request.taskLinkTemplates ?? [],
        accountingPeriod,
    };
}
