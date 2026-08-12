import { randomUUID } from 'crypto';
import { AggregateID, Entity } from '@/shared/domain/entity.base';
import { CalculationLine } from '@/shared/domain/calculation-line';
import type { ShopCalculationContext } from '../../types/shop-calculation-context.types';
import {
    CreateShopSalaryRuleProps,
    ShopSalaryRule,
    TargetRole,
    TaskCompletedShopSalaryConfig,
    TaskCompletedShopSalaryRule,
} from '../../types/shop-salary-rule.types';
import type { ShopCalculationErpData } from '../../types/shop-calculation-data.types';
import { roundRubles } from '../../services/money';
import { resolveFloatPercentMultiplier } from '../../services/float-percent';
import { ShopSalesPerformanceRequiredException } from '../../exceptions/float-percent.exception';

// Правило "вознаграждение за выполненную задачу" магазина (Фаза 13, issue
// #64, см. docs/payroll/plan-payroll-calculation.md). Зеркало
// TaskCompletedEntity сервиса
// (domains/service/modules/accounting/domain/entities/salary-rules/task-completed.entity.ts)
// по структуре (award Fixed/FloatPercent, матчинг напрямую по
// employeeId), но независимая реализация (issue #57).
//
// Источник данных — erpData.taskCompletions (ShopTaskCompletionErpItem, см.
// shop-calculation-data.types.ts): что считается "задачей" для
// TaskCompleted в магазине — открытый вопрос PRD, НЕ решённый ни для
// сервиса, ни для магазина. Решение по умолчанию (то же, что и у сервиса в
// Фазе 8): тот же временный внутренний источник — TaskCompletion
// (domains/service/modules/accounting/domain/entities/task-completion.entity.ts),
// различаемый по TaskCompletion.direction, а не отдельная шоп-специфичная
// сущность (см. комментарий у ShopTaskCompletionErpItem).
//
// Роль правила (targetRole) здесь НЕ фильтрует выборку — как и у сервиса:
// у "выполненной задачи" нет ролевых полей ERP, матчинг идёт по прямому
// совпадению context.employee.id === completion.employeeId; targetRole
// остаётся обязательным полем контракта (общая часть формы правила) и
// используется только для группировки/отображения в UI.
export class TaskCompletedShopEntity
    extends Entity<TaskCompletedShopSalaryRule>
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

    get config(): TaskCompletedShopSalaryConfig {
        return this.props.config;
    }

    static create(rule: CreateShopSalaryRuleProps): TaskCompletedShopEntity {
        return new TaskCompletedShopEntity({
            id: randomUUID(),
            props: {
                name: rule.name,
                type: 'TaskCompleted',
                targetRole: rule.targetRole,
                config: rule.config as TaskCompletedShopSalaryConfig,
            },
        });
    }

    calculate(context: ShopCalculationContext): CalculationLine {
        const erpData = context.erpData as ShopCalculationErpData | undefined;
        const completions = erpData?.taskCompletions ?? [];
        const matched = completions.filter(
            (completion) => completion.employeeId === context.employee.id,
        );
        const quantity = matched.length;
        const sources = matched.map((completion) => ({
            type: 'taskCompletion',
            id: completion.id,
        }));
        const bonus = this.props.config.bonus ?? 0;
        const award = this.props.config.award;

        switch (award.type) {
            case 'Fixed': {
                // quantity — целое число подтверждённых задач, round не
                // нужен (то же решение, что и у TaskCompletedEntity
                // сервиса — в отличие от ProductSold/UsedProductSold, у
                // TaskCompleted нет дробного quantity).
                const amount = award.price * quantity + bonus;
                return {
                    ruleId: this.id,
                    quantity,
                    rate: award.price,
                    amount,
                    sources,
                };
            }
            case 'FloatPercent': {
                // TaskCompleted не привязан к категории (у конфига нет
                // поля category, см. TaskCompletedShopSalaryConfig) —
                // всегда читает запись "весь отдел" карты
                // context.salesPerformance (ключ null, см.
                // shop-calculation-context.types.ts). Поведение не
                // изменилось Фазой 2 плана
                // shop-sales-performance-by-category — та переключала
                // только ProductSold (см. product-sold.entity.ts).
                const percentCompletion = context.salesPerformance?.get(null);
                if (percentCompletion === undefined) {
                    throw new ShopSalesPerformanceRequiredException(
                        context.period.period,
                    );
                }
                const multiplier = resolveFloatPercentMultiplier(
                    award.percentBorders,
                    percentCompletion,
                );
                const amount =
                    roundRubles(award.basePrice * quantity * multiplier) +
                    bonus;
                return {
                    ruleId: this.id,
                    quantity,
                    rate: award.basePrice * multiplier,
                    amount,
                    sources,
                };
            }
        }
    }

    validate(): void {}
}
