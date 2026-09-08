import { randomUUID } from 'crypto';
import { AggregateID, Entity } from '@/shared/domain/entity.base';
import { CalculationLine } from '@/shared/domain/calculation-line';
import {
    CreateShopSalaryRuleProps,
    ProductSoldSalaryConfig,
    ProductSoldSalaryRule,
    ShopSalaryBasis,
    ShopSalaryRule,
    TargetRole,
} from '../../types/salary-rule.types';
import type { ShopCalculationContext } from '../../types/calculation-context.types';
import type {
    ShopCalculationErpData,
    ShopProductSoldErpItem,
} from '../../types/calculation-data.types';
import { employeeMatchesShopDemandRole } from '../../services/role-source';
import { Money } from '../../value-objects/money.value-object';
import { FloatPercentSchedule } from '../../value-objects/float-percent-schedule.value-object';
import { buildErpDemandLink } from '../../services/erp-demand-link-builder';

// Правило "вознаграждение за проданный товар в категории" (Фаза 12, issue
// #59/#60, см. docs/payroll/plan-payroll-calculation.md и
// prd-payroll-calculation.md, раздел "Роли магазина"). Источник данных —
// MoySkladDemandPosition (+ MoySkladProduct.folderId для категории),
// зеркало OrderPayedEntity сервиса по структуре (award/salaryBasis/
// FloatPercent), но независимая реализация — issue #57.
//
// Роль правила — ONLINE_MANAGER/OFFLINE_MANAGER (уровень отгрузки, issue
// #58); ONLINE_PURCHASER/OFFLINE_PURCHASER — не для этого правила (см.
// employeeMatchesShopDemandRole, бросает ArgumentInvalidException для
// "не своих" ролей — используются будущим UsedProductSold, Фаза 13).
//
// Позиция попадает в период по MoySkladDemand.moment своей отгрузки —
// фильтрация периода уже применена источником данных (application-слой,
// строящий erpData), сюда попадают только позиции периода. Частичная
// оплата (payedSum < sum) не учитывается — расчёт идёт по факту отгрузки
// (issue #59).
export class ProductSoldEntity
    extends Entity<ProductSoldSalaryRule>
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

    get config(): ProductSoldSalaryConfig {
        return this.props.config;
    }

    // Entity.constructor вызывает validate() сам (см. entity.base.ts) —
    // невалидный FloatPercent (см. validate() ниже) бросает исключение уже
    // здесь, при создании.
    static create(rule: CreateShopSalaryRuleProps): ProductSoldEntity {
        return new ProductSoldEntity({
            id: randomUUID(),
            props: {
                name: rule.name,
                type: 'ProductSold',
                targetRole: rule.targetRole,
                config: rule.config as ProductSoldSalaryConfig,
            },
        });
    }

    calculate(context: ShopCalculationContext): CalculationLine {
        const erpData = context.erpData as ShopCalculationErpData | undefined;
        const items = erpData?.productSoldItems ?? [];
        const matched = this.dedupeByPosition(
            items.filter(
                (item) =>
                    this.matchesRole(context, item) &&
                    this.matchesCategory(item, erpData),
            ),
        );
        const award = this.props.config.award;
        // spec: shop/accounting#requirement-награда-по-количеству-считается-по-сумме-количества-а-не-по-числу-позиций
        const totalQuantity = matched.reduce(
            (sum, item) => sum + item.quantity,
            0,
        );

        switch (award.type) {
            case 'Fixed': {
                const amount = Money.roundRubles(
                    award.price * totalQuantity,
                ).getValue();
                return {
                    ruleId: this.id,
                    quantity: totalQuantity,
                    rate: award.price,
                    amount,
                    sources: this.buildSources(matched, (item) =>
                        Money.roundRubles(
                            award.price * item.quantity,
                        ).getValue(),
                    ),
                };
            }
            case 'FixedPercent': {
                const base = this.sumBasis(matched, award.salaryBasis);
                const amount = Money.roundRubles(
                    (base * award.percent) / 100,
                ).getValue();
                return {
                    ruleId: this.id,
                    salaryBasis: award.salaryBasis,
                    quantity: totalQuantity,
                    rate: award.percent,
                    amount,
                    sources: this.buildSources(matched, (item) =>
                        Money.roundRubles(
                            (this.basisAmount(item, award.salaryBasis) *
                                award.percent) /
                                100,
                        ).getValue(),
                    ),
                };
            }
            case 'FloatPercent': {
                // spec: shop/accounting#requirement-процент-выполнения-плана-продаж-резолвится-по-собственной-категории-правила
                //
                // Application-слой (BuildShopCalculationContextService) резолвит
                // salesPerformance по каждой уникальной category правил
                // ProductSold/UsedProductSold через
                // ShopSalesPerformanceReaderPort.findForScope(period, department,
                // category) и складывает результат в карту context.salesPerformance
                // (category → percentCompletion, ключ null — «весь отдел», см.
                // calculation-context.types.ts).
                const percentCompletion = context.salesPerformance?.get(
                    this.props.config.category,
                );
                if (percentCompletion === undefined) {
                    return {
                        ruleId: this.id,
                        salaryBasis: award.salaryBasis,
                        quantity: 0,
                        rate: 0,
                        amount: 0,
                        sources: [],
                    };
                }
                const multiplier = FloatPercentSchedule.create(
                    award.percentBorders,
                ).resolveMultiplier(percentCompletion);
                const base = this.sumBasis(matched, award.salaryBasis);
                const amount = Money.roundRubles(
                    (base * award.basePercent * multiplier) / 100,
                ).getValue();
                return {
                    ruleId: this.id,
                    salaryBasis: award.salaryBasis,
                    quantity: totalQuantity,
                    rate: award.basePercent * multiplier,
                    amount,
                    sources: this.buildSources(matched, (item) =>
                        Money.roundRubles(
                            (this.basisAmount(item, award.salaryBasis) *
                                award.basePercent *
                                multiplier) /
                                100,
                        ).getValue(),
                    ),
                };
            }
        }
    }

    // Fixed/FixedPercent не имеют собственных инвариантов сверх формы,
    // уже проверенной zod-схемой на границе — только FloatPercent несёт
    // percentBorders с семантическими инвариантами (порядок/уникальность/
    // диапазон), которые форма выразить не может, см.
    // FloatPercentSchedule.create(). Вызывается автоматически конструктором
    // Entity (entity.base.ts) — и при create() (создание через API), и при
    // конструировании в ShopSalaryRuleMapper.toDomain() (fail closed при
    // чтении из БД) — отдельно вызывать не нужно.
    validate(): void {
        const award = this.props.config.award;
        if (award.type === 'FloatPercent') {
            FloatPercentSchedule.create(award.percentBorders);
        }
    }

    private buildSources(
        items: ShopProductSoldErpItem[],
        amountFor: (item: ShopProductSoldErpItem) => number,
    ) {
        return items.map((item) => ({
            type: 'demandPosition',
            id: item.positionId,
            label: item.demandLabel,
            link: buildErpDemandLink(item.demandId),
            itemName: item.itemName,
            amount: amountFor(item),
        }));
    }

    private matchesRole(
        context: ShopCalculationContext,
        item: ShopProductSoldErpItem,
    ): boolean {
        return employeeMatchesShopDemandRole(
            context.employee,
            this.targetRole,
            {
                onlineManagerId: item.onlineManagerId,
                offlineManagerId: item.offlineManagerId,
            },
        );
    }

    // spec: shop/accounting#requirement-категория-обязательная-часть-правила-вознаграждения-за-товар
    //
    // Раскрытие до потомков дерева уже сделано application-слоем в
    // erpData.categoryDescendantFolderIds (см. calculation-data.types.ts) —
    // правило лишь сверяет собственный folderId позиции со списком по ключу
    // категории.
    private matchesCategory(
        item: ShopProductSoldErpItem,
        erpData: ShopCalculationErpData | undefined,
    ): boolean {
        const category = this.props.config.category;
        if (category === null) {
            return true;
        }
        if (item.folderId === null) {
            return false;
        }
        const allowedFolderIds =
            erpData?.categoryDescendantFolderIds?.[category];
        if (!allowedFolderIds) {
            // spec: shop/accounting#requirement-категория-обязательная-часть-правила-вознаграждения-за-товар
            return false;
        }
        return allowedFolderIds.includes(item.folderId);
    }

    // spec: shop/accounting#requirement-дедупликация-одной-и-той-же-позиции-внутри-правила
    //
    // Источник данных в норме отдаёт одну позицию одной строкой, но если по
    // какой-то причине один и тот же positionId попал в выборку дважды
    // (например, из-за пересечения по нескольким совпавшим полям), сумма не
    // должна удвоиться. Это НЕ дедупликация между разными правилами (онлайн-
    // и офлайн-менеджер, даже будучи одним и тем же сотрудником, получают
    // оплату по каждому своему правилу независимо).
    private dedupeByPosition(
        items: ShopProductSoldErpItem[],
    ): ShopProductSoldErpItem[] {
        return [
            ...new Map(items.map((item) => [item.positionId, item])).values(),
        ];
    }

    private sumBasis(
        items: ShopProductSoldErpItem[],
        basis: ShopSalaryBasis,
    ): number {
        return items.reduce(
            (sum, item) => sum + this.basisAmount(item, basis),
            0,
        );
    }

    private basisAmount(
        item: ShopProductSoldErpItem,
        basis: ShopSalaryBasis,
    ): number {
        switch (basis) {
            case 'REVENUE':
                return item.sum;
            case 'MARGIN':
                return item.profit;
        }
    }
}
