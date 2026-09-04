import { randomUUID } from 'crypto';
import { AggregateID, Entity } from '@/shared/domain/entity.base';
import { CalculationContext } from '@/shared/domain/calculation-context';
import { CalculationLine } from '@/shared/domain/calculation-line';
import {
    CreateSalaryRuleProps,
    OrderPayedSalaryConfig,
    OrderPayedSalaryRule,
    SalaryBasis,
    SalaryRule,
    TargetRole,
} from '@/domains/service/modules/accounting/domain/types/salary-rule.types';
import {
    employeeMatchesServiceRole,
    hasRoappEmployeeIdentity,
} from '@/domains/service/modules/accounting/domain/services/role-source';
import { roundRubles } from '@/domains/service/modules/accounting/domain/services/money';
import { resolveFloatPercentMultiplier } from '@/domains/service/modules/accounting/domain/services/float-percent';
import { buildErpOrderLink } from '@/domains/service/modules/accounting/domain/services/erp-order-link-builder';
import { SalesPerformanceRequiredException } from '@/domains/service/modules/accounting/domain/exceptions/float-percent.exception';
import type {
    OrderPayedErpItem,
    ServiceCalculationErpData,
} from '@/domains/service/modules/accounting/domain/types/calculation-data.types';

// spec: service/accounting#scenario-оплаченность-заказа-определяется-его-статусом-а-не-накопленной-суммой
//
// "Оплаченный" решается по группе статуса заказа (см. domain/services/paid-order-status.ts), сама
// фильтрация уже применена источником данных
// (ServiceCalculationDataRepository.findOrderPayedItems) — сюда попадают только заказы, прошедшие
// этот фильтр.
export class OrderPayedEntity
    extends Entity<OrderPayedSalaryRule>
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

    get config(): OrderPayedSalaryConfig {
        return this.props.config;
    }

    static create(rule: CreateSalaryRuleProps): OrderPayedEntity {
        return new OrderPayedEntity({
            id: randomUUID(),
            props: {
                name: rule.name,
                type: 'OrderPayed',
                targetRole: rule.targetRole,
                config: rule.config as OrderPayedSalaryConfig,
            },
        });
    }

    calculate(context: CalculationContext): CalculationLine {
        const erpData = context.erpData as
            ServiceCalculationErpData | undefined;

        const items = erpData?.orderPayedItems ?? [];
        const matched = this.dedupeBySource(
            items.filter((item) => this.matchesOrder(context, item)),
        );
        const award = this.props.config.award;

        switch (award.type) {
            case 'Fixed': {
                const amount = award.price * matched.length;
                return {
                    ruleId: this.id,
                    quantity: matched.length,
                    rate: award.price,
                    amount,
                    sources: this.buildSources(matched, () => award.price),
                };
            }
            case 'FixedPercent': {
                const base = this.sumBasis(matched, award.salaryBasis);
                const amount = roundRubles((base * award.percent) / 100);
                return {
                    ruleId: this.id,
                    salaryBasis: award.salaryBasis,
                    quantity: matched.length,
                    rate: award.percent,
                    amount,
                    sources: this.buildSources(matched, (item) =>
                        roundRubles(
                            (this.basisAmount(item, award.salaryBasis) *
                                award.percent) /
                                100,
                        ),
                    ),
                };
            }
            case 'FloatPercent': {
                if (!context.salesPerformance) {
                    throw new SalesPerformanceRequiredException(
                        context.period.period,
                    );
                }
                const multiplier = resolveFloatPercentMultiplier(
                    award.percentBorders,
                    context.salesPerformance.percentCompletion,
                );
                const base = this.sumBasis(matched, award.salaryBasis);
                const amount = roundRubles(
                    (base * award.basePercent * multiplier) / 100,
                );
                return {
                    ruleId: this.id,
                    salaryBasis: award.salaryBasis,
                    quantity: matched.length,
                    rate: award.basePercent * multiplier,
                    amount,
                    sources: this.buildSources(matched, (item) =>
                        roundRubles(
                            (this.basisAmount(item, award.salaryBasis) *
                                award.basePercent *
                                multiplier) /
                                100,
                        ),
                    ),
                };
            }
        }
    }

    // Строит sources[] с суммой начисления, приходящейся на каждый
    // конкретный заказ (не персональная доля от округлённой суммы всего
    // правила, а независимо посчитанная база×ставка для этого заказа —
    // см. calculation-line.ts), плюс человекочитаемый номер заказа и прямую
    // ссылку на его карточку в RemOnline, чтобы сотрудник мог перейти и
    // увидеть, за что начислена сумма.
    private buildSources(
        items: OrderPayedErpItem[],
        amountFor: (item: OrderPayedErpItem) => number,
    ) {
        return items.map((item) => ({
            type: 'order',
            id: item.orderId,
            label: item.label,
            link: buildErpOrderLink(item.orderId),
            amount: amountFor(item),
            brand: item.brand ?? undefined,
            deviceModel: item.deviceModel ?? undefined,
            deviceColor: item.deviceColor ?? undefined,
            malfunction: item.malfunction ?? undefined,
        }));
    }

    validate(): void {}

    // Роль ENGINEER — единственная, для которой у заказа нет одного поля с
    // сотрудником (в отличие от остальных трёх ролей, целиком лежащих на
    // уровне заказа — см. service-role-source.ts): инженер закреплён за
    // ПОЗИЦИЕЙ заказа (услугой/товаром), а не за заказом целиком, и у
    // одного заказа их может быть несколько. Решение по этому открытому
    // вопросу (не описанному явно в PRD для OrderPayed): сотрудник
    // считается инженером заказа для целей OrderPayed, если он инженер
    // хотя бы одной позиции этого заказа (item.engineerIds) — тот же дух,
    // что и у ServiceCompleted, где роль всегда определяется на уровне
    // позиции, но OrderPayed агрегирует начисление по заказу целиком.
    // Остальные три роли переиспользуют employeeMatchesServiceRole
    // (Фаза 7) без изменений — engineerId в фиктивном поле не участвует ни
    // в одной их ветке.
    private matchesOrder(
        context: CalculationContext,
        item: OrderPayedErpItem,
    ): boolean {
        if (!this.matchesOrderType(item)) {
            return false;
        }
        if (this.targetRole === 'ENGINEER') {
            return item.engineerIds.some((engineerId) =>
                hasRoappEmployeeIdentity(context.employee, engineerId),
            );
        }
        return employeeMatchesServiceRole(context.employee, this.targetRole, {
            engineerId: 0,
            managerId: item.managerId,
            onlineManager: item.onlineManager,
        });
    }

    // spec: service/accounting#requirement-оплату-за-услугу-и-вознаграждение-за-заказ-можно-ограничить-типами-заказа
    //
    // config.orderTypeIds — список допустимых RoappOrderType (RoappOrder.orderTypeId).
    private matchesOrderType(item: OrderPayedErpItem): boolean {
        const { orderTypeIds } = this.props.config;
        if (!orderTypeIds || orderTypeIds.length === 0) {
            return true;
        }
        return orderTypeIds.includes(item.orderTypeId);
    }

    // Дедупликация «правило × источник» (Фаза 8, см. PRD "для правил с
    // одинаковой базой и пересекающейся выборкой действует дедупликация").
    // Источник данных уже отдаёт один заказ одной строкой, поэтому дублей
    // в норме не бывает — защита на случай, если один и тот же заказ
    // теоретически попадёт в выборку дважды (например, через несколько
    // совпавших инженеров), чтобы сумма не удвоилась.
    private dedupeBySource(items: OrderPayedErpItem[]): OrderPayedErpItem[] {
        return [...new Map(items.map((item) => [item.orderId, item])).values()];
    }

    private sumBasis(items: OrderPayedErpItem[], basis: SalaryBasis): number {
        return items.reduce(
            (sum, item) => sum + this.basisAmount(item, basis),
            0,
        );
    }

    // База начисления — исходные суммы заказа (payed/cost/engineerSalary),
    // а не legacy-KPI RoappOrder.managerSalary (см. заголовок файла и
    // ServiceCalculationDataRepository.findOrderPayedItems).
    private basisAmount(item: OrderPayedErpItem, basis: SalaryBasis): number {
        switch (basis) {
            case 'REVENUE':
                return item.revenue;
            case 'MARGIN':
                return item.revenue - item.cost;
            case 'SALARY_MINUS_ENGINEER_SALARY':
                return item.revenue - item.cost - item.engineerSalary;
        }
    }
}
