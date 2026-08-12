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
} from '../../types/shop-salary-rule.types';
import type { ShopCalculationContext } from '../../types/shop-calculation-context.types';
import type {
    ShopCalculationErpData,
    ShopProductSoldErpItem,
} from '../../types/shop-calculation-data.types';
import { employeeMatchesShopPurchaserRole } from '../../services/shop-role-source';
import { roundRubles } from '../../services/money';

// Правило "вознаграждение закупщику за продажу выкупленной им БУ техники"
// (Фаза 13, issue #62/#63, см. docs/payroll/plan-payroll-calculation.md и
// prd-payroll-calculation.md, раздел "Закупщики БУ техники"). Зеркало
// ProductSoldEntity по структуре (category/award/salaryBasis/дедупликация),
// но независимая реализация (issue #57) и три содержательных отличия:
//
// 1. Роль — ONLINE_PURCHASER/OFFLINE_PURCHASER, уровень ТОВАРНОЙ ПОЗИЦИИ
//    (employeeMatchesShopPurchaserRole), а не отгрузки.
// 2. award — только Fixed/FixedPercent, БЕЗ FloatPercent: вознаграждение
//    закупщика не привязано к выполнению плана продаж (issue #62).
// 3. Источник данных — тот же erpData.productSoldItems, что и у
//    ProductSoldEntity (issue #63: "переиспользуй тот же источник данных...
//    не изобретай отдельный источник данных под выкуп"), просто матчинг
//    идёт по полям закупщика (onlinePurchaserId/offlinePurchaserId), а не
//    менеджера. Позиция физически попадает в productSoldItems уже
//    отфильтрованной application-слоем по MoySkladDemand.moment своей
//    отгрузки — поэтому момент начисления закупщику автоматически становится
//    ПРОДАЖЕЙ, а не выкупом (issue #63): выкупленный, но ещё не проданный
//    (не попавший ни в одну отгрузку периода) остаток в этот массив не
//    попадает вообще, calculate() его никогда не увидит.
//
// Дедупликация «правило × позиция» (issue #65) — тот же защитный механизм,
// что у ProductSoldEntity.dedupeByPosition: НЕ дедупликация между
// ProductSold и UsedProductSold (это разные правила — продавец и закупщик
// получают оплату независимо, даже если это один и тот же сотрудник, PRD:
// "разные люди и разные правила, двойным начислением не считается"), а
// защита от повторения одной и той же позиции внутри выборки ОДНОГО этого
// правила.
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
        const sources = matched.map((item) => ({
            type: 'demandPosition',
            id: item.positionId,
        }));
        const bonus = this.props.config.bonus ?? 0;
        const award = this.props.config.award;
        // Fixed — "за единицу проданного устройства" (issue #62), то же
        // явное решение на дробном quantity, что у ProductSold (issue #60):
        // сумма quantity, а не число позиций.
        const totalQuantity = matched.reduce(
            (sum, item) => sum + item.quantity,
            0,
        );

        switch (award.type) {
            case 'Fixed': {
                const amount = roundRubles(award.price * totalQuantity) + bonus;
                return {
                    ruleId: this.id,
                    quantity: totalQuantity,
                    rate: award.price,
                    amount,
                    sources,
                };
            }
            case 'FixedPercent': {
                const base = this.sumBasis(matched, award.salaryBasis);
                const amount =
                    roundRubles((base * award.percent) / 100) + bonus;
                return {
                    ruleId: this.id,
                    salaryBasis: award.salaryBasis,
                    quantity: totalQuantity,
                    rate: award.percent,
                    amount,
                    sources,
                };
            }
        }
    }

    validate(): void {}

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

    // Необязательная категория (issue #62: "ставка за БУ айфон и за БУ
    // ноутбук может отличаться") — идентичная логика ProductSoldEntity,
    // включая fail closed при незаполненном раскрытии дерева.
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
