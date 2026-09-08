import { randomUUID } from 'crypto';
import { AggregateID, Entity } from '@/shared/domain/entity.base';
import { CalculationLine } from '@/shared/domain/calculation-line';
import {
    CreateShopSalaryRuleProps,
    ShopSalaryBasis,
    ShopSalaryRule,
    TargetRole,
    UsedProductSoldSalaryConfig,
    UsedProductSoldSalaryRule,
} from '../../types/salary-rule.types';
import type { ShopCalculationContext } from '../../types/calculation-context.types';
import type {
    ShopCalculationErpData,
    ShopProductSoldErpItem,
} from '../../types/calculation-data.types';
import { employeeMatchesShopPurchaserRole } from '../../services/role-source';
import { Money } from '../../value-objects/money.value-object';
import { buildErpDemandLink } from '../../services/erp-demand-link-builder';

// Правило "вознаграждение закупщику за продажу выкупленной им БУ техники"
// (Фаза 13, issue #62/#63, см. docs/payroll/plan-payroll-calculation.md и
// prd-payroll-calculation.md, раздел "Закупщики БУ техники"). Зеркало
// ProductSoldEntity по структуре (category/award/salaryBasis/дедупликация),
// но независимая реализация (issue #57) и три содержательных отличия:
//
// 1. Роль — ONLINE_PURCHASER/OFFLINE_PURCHASER, уровень ТОВАРНОЙ ПОЗИЦИИ
//    (employeeMatchesShopPurchaserRole), а не отгрузки.
// 2. award — только Fixed/FixedPercent, БЕЗ FloatPercent.
// 3. Источник данных — тот же erpData.productSoldItems, что и у
//    ProductSoldEntity ("переиспользуй тот же источник данных... не
//    изобретай отдельный источник данных под выкуп"), просто матчинг идёт
//    по полям закупщика (onlinePurchaserId/offlinePurchaserId), а не
//    менеджера.
// spec: shop/accounting#requirement-вознаграждение-закупщику-считается-только-по-продаже-не-по-факту-выкупа
//
// spec: shop/accounting#requirement-дедупликация-одной-и-той-же-позиции-внутри-правила
//
// Тот же защитный механизм, что у ProductSoldEntity.dedupeByPosition —
// защита от повторения одной и той же позиции внутри выборки ОДНОГО этого
// правила (не между ProductSold и UsedProductSold).
export class UsedProductSoldEntity
    extends Entity<UsedProductSoldSalaryRule>
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

    get config(): UsedProductSoldSalaryConfig {
        return this.props.config;
    }

    static create(rule: CreateShopSalaryRuleProps): UsedProductSoldEntity {
        return new UsedProductSoldEntity({
            id: randomUUID(),
            props: {
                name: rule.name,
                type: 'UsedProductSold',
                targetRole: rule.targetRole,
                config: rule.config as UsedProductSoldSalaryConfig,
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
        }
    }

    validate(): void {}

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
        return employeeMatchesShopPurchaserRole(
            context.employee,
            this.targetRole,
            {
                onlinePurchaserId: item.onlinePurchaserId,
                offlinePurchaserId: item.offlinePurchaserId,
            },
        );
    }

    // spec: shop/accounting#requirement-вознаграждение-закупщику-считается-только-по-продаже-не-по-факту-выкупа
    // spec: shop/accounting#requirement-категория-обязательная-часть-правила-вознаграждения-за-товар
    //
    // Идентичная логика ProductSoldEntity, включая fail closed при
    // незаполненном раскрытии дерева.
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
            return false;
        }
        return allowedFolderIds.includes(item.folderId);
    }

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
