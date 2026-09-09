import { randomUUID } from 'crypto';
import { AggregateID, Entity } from '@/shared/domain/entity.base';
import { CalculationContext } from '@/shared/domain/calculation-context';
import { CalculationLine } from '@/shared/domain/calculation-line';
import { buildBitrixTaskLink } from '@/integrations/bitrix/bitrix-task-link-builder';
import {
    CreateSalaryRuleProps,
    SalaryRule,
    TargetRole,
    TaskCompletionSalaryConfig,
    TaskCompletionSalaryRule,
} from '@/domains/service/modules/accounting/domain/types/salary-rule.types';
import type { ServiceCalculationErpData } from '@/domains/service/modules/accounting/domain/types/calculation-data.types';

// Раздел 10 tasks.md (add-task-based-salary-rule): правило «за выполнение
// задачи» — единственный тип правила сервиса, чей calculate() может вернуть
// null (см. domain/types/salary-rule.types.ts, SalaryRule.calculate()) —
// spec: service/accounting#requirement-правило-за-выполнение-задачи-не-видно-в-прогнозе-до-выполнения.
//
// Связанная задача Bitrix24 (SalaryTask, раздел 9) не хранится в props
// правила и не читается репозиторием отсюда напрямую (правило не ходит в БД
// само, см. calculation-context.ts) — её статус/bitrixTaskId приходят через
// context.erpData.taskCompletionStatuses, заполняемый
// BuildServiceCalculationContextService (раздел 12) по ruleId (this.id).
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

    static create(rule: CreateSalaryRuleProps): TaskCompletion {
        return new TaskCompletion({
            id: randomUUID(),
            props: {
                name: rule.name,
                type: 'TaskCompletion',
                targetRole: rule.targetRole,
                config: rule.config as TaskCompletionSalaryConfig,
            },
        });
    }

    // spec: service/accounting#requirement-сумма-начисления-по-правилу-за-выполнение-задачи-задаётся-руководителем-вручную
    //
    // null — задача ещё не заведена (нет записи в erpData.taskCompletionStatuses
    // за этот проход) ИЛИ статус связанной задачи ещё не «Выполнено».
    // amount ВСЕГДА равен config.defaultAmount (сумма по умолчанию, заданная
    // при создании правила) — requiresManualInput ВСЕГДА true при статусе
    // Done, руководитель по-прежнему обязан явно подтвердить/изменить сумму
    // и указать комментарий при проведении (SetTaskCompletionLineReward,
    // design.md Decision 5); действующая сумма живёт только на
    // SalaryAccrualLine и не пересчитывается здесь, независимо от того,
    // вводил ли руководитель сумму на уже существующем документе начисления
    // ранее (тот же принцип, что и adjust() у других типов правил — не
    // влияет на live-пересчёт открытого периода).
    calculate(context: CalculationContext): CalculationLine | null {
        const erpData = context.erpData as
            ServiceCalculationErpData | undefined;

        const entry = erpData?.taskCompletionStatuses?.[this.id];
        if (!entry || !entry.status.isDone()) {
            return null;
        }

        return {
            ruleId: this.id,
            amount: this.props.config.defaultAmount,
            requiresManualInput: true,
            sources: this.buildSources(entry.bitrixTaskId),
        };
    }

    // design.md Decision 7 (add-task-based-salary-rule) — детализация строки
    // показывает название/ссылку связанной задачи через существующий
    // CalculationSourceRef, без нового UI-механизма.
    //
    // label — название задачи, как оно введено на самом правиле
    // (config.bitrixTaskTitle) — это же значение уходит в Bitrix24 при
    // создании задачи (tasks.task.add, раздел 12), поэтому не требует
    // отдельного запроса за названием задачи из ERP.
    private buildSources(bitrixTaskId: string) {
        return [
            {
                type: 'taskCompletion',
                id: bitrixTaskId,
                label: this.props.config.bitrixTaskTitle,
                link: buildBitrixTaskLink(bitrixTaskId),
            },
        ];
    }

    validate(): void {}
}
