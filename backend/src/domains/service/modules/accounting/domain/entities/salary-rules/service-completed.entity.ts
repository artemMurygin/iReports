import { AggregateID, Entity } from '@/shared/domain/entity.base';
import { CalculationContext } from '@/shared/domain/calculation-context';
import { CalculationLine } from '@/shared/domain/calculation-line';
import {
    CreateSalaryRuleProps,
    SalaryRule,
    ServiceCompletedSalaryConfig,
    ServiceCompletedSalaryRule,
    TargetRole,
} from '@/domains/service/modules/accounting/domain/types/salary-rule.types';
import { employeeMatchesServiceRole } from '@/domains/service/modules/accounting/domain/services/service-role-source';
import { roundRubles } from '@/domains/service/modules/accounting/domain/services/money';
import type { ServiceCalculationErpData } from '@/domains/service/modules/accounting/domain/types/service-calculation-data.types';
import { randomUUID } from 'crypto';

export class ServiceCompletedEntity
    extends Entity<ServiceCompletedSalaryRule>
    implements SalaryRule
{
    declare protected _id: AggregateID;

    // Восстановление уже существующего в БД правила — не через create(), а
    // прямым `new` (см. SalaryRuleMapper.toDomain), поэтому здесь только

    get name(): string {
        return this.props.name;
    }

    get type(): string {
        return this.props.type;
    }

    get targetRole(): TargetRole {
        return this.props.targetRole;
    }

    get config(): ServiceCompletedSalaryConfig {
        return this.props.config;
    }

    // сценарий "создать с нуля": id и даты всегда генерируются заново.
    static create(rule: CreateSalaryRuleProps): ServiceCompletedEntity {
        return new ServiceCompletedEntity({
            id: randomUUID(),
            props: {
                name: rule.name,
                type: 'ServiceCompleted',
                targetRole: rule.targetRole,
                config: rule.config as ServiceCompletedSalaryConfig,
            },
        });
    }

    // Правило само определяет выборку по своей роли (Фаза 7): фильтрует
    // позиции оказанных услуг периода (context.erpData.serviceCompletedItems)
    // по тому, встречается ли сотрудник в поле ERP, соответствующем
    // targetRole правила (см. service-role-source.ts) — например, ENGINEER
    // считает только по позициям со своим инженером, другие услуги того же
    // периода на сумму не влияют.
    calculate(context: CalculationContext): CalculationLine {
        const erpData = context.erpData as
            | ServiceCalculationErpData
            | undefined;
        const items = erpData?.serviceCompletedItems ?? [];
        const matched = items.filter((item) =>
            employeeMatchesServiceRole(context.employee, this.targetRole, item),
        );
        const quantity = matched.reduce((sum, item) => sum + item.quantity, 0);
        const sources = matched.map((item) => ({
            type: 'serviceOrderItem',
            id: item.serviceOrderId,
        }));
        const bonus = this.props.config.bonus ?? 0;
        const award = this.props.config.award;

        switch (award.type) {
            case 'Fixed': {
                const amount = award.price * quantity + bonus;
                return {
                    ruleId: this.id,
                    quantity,
                    rate: award.price,
                    amount,
                    sources,
                };
            }
            case 'ServiceFixed': {
                // Ставка "за услугу" из справочника (RoappService.engeneerBonus)
                // — своя на каждую услугу, поэтому единого rate для строки
                // нет (см. CalculationLine.rate — опционален).
                const amount =
                    matched.reduce(
                        (sum, item) =>
                            sum + item.catalogEngineerBonus * item.quantity,
                        0,
                    ) + bonus;
                return { ruleId: this.id, quantity, amount, sources };
            }
            case 'ServicePercent': {
                const base = matched.reduce(
                    (sum, item) => sum + item.linePrice * item.quantity,
                    0,
                );
                const amount =
                    roundRubles((base * award.percent) / 100) + bonus;
                return {
                    ruleId: this.id,
                    // Базы REVENUE/MARGIN и т.п. у ServiceCompleted нет —
                    // процент берётся от стоимости оказанной услуги по этой
                    // позиции заказа (item.linePrice), это и есть база.
                    salaryBasis: 'SERVICE_PRICE',
                    quantity,
                    rate: award.percent,
                    amount,
                    sources,
                };
            }
        }
    }

    validate(): void {}
}
