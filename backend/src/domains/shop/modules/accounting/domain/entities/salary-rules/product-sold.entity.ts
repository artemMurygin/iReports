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
} from '../../types/shop-salary-rule.types';
import type { ShopCalculationContext } from '../../types/shop-calculation-context.types';
import type {
    ShopCalculationErpData,
    ShopProductSoldErpItem,
} from '../../types/shop-calculation-data.types';
import { employeeMatchesShopDemandRole } from '../../services/shop-role-source';
import { roundRubles } from '../../services/money';
import { resolveFloatPercentMultiplier } from '../../services/float-percent';

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
        const sources = matched.map((item) => ({
            type: 'demandPosition',
            id: item.positionId,
        }));
        const bonus = this.props.config.bonus ?? 0;
        const award = this.props.config.award;
        // Fixed на дробном quantity (issue #60): "сумма за единицу" магазина
        // считается по количеству, а не по числу позиций — товар может быть
        // весовым/дробным (MoySkladDemandPosition.quantity — Float), поэтому
        // 1.5 кг товара с наградой "100 ₽ за единицу" даёт 150 ₽, а не 100 ₽
        // за "одну позицию". Явное решение, зафиксированное по требованию
        // issue: не count(matched), а сумма quantity по matched.
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
            case 'FloatPercent': {
                // Issue #60 закрыт (Фаза 2 плана
                // shop-sales-performance-by-category): FloatPercent берёт
                // процент выполнения плана СВОЕЙ категории, а не отдела
                // целиком — application-слой (BuildShopCalculationContextService)
                // резолвит salesPerformance по каждой уникальной category
                // правил ProductSold/UsedProductSold схемы через
                // ShopSalesPerformanceReaderPort.findForScope(period,
                // department, category) и складывает результат в карту
                // context.salesPerformance (category → percentCompletion,
                // ключ null — «весь отдел», см. shop-calculation-context.types.ts).
                // Fail closed — тот же принцип, что и у matchesCategory
                // ниже для categoryDescendantFolderIds: если для
                // this.props.config.category в карте нет расчёта (нет
                // плана/факта по этому scope), вознаграждение не
                // начисляется, а не считается по проценту чужой
                // категории/отдела.
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
                const multiplier = resolveFloatPercentMultiplier(
                    award.percentBorders,
                    percentCompletion,
                );
                const base = this.sumBasis(matched, award.salaryBasis);
                const amount =
                    roundRubles((base * award.basePercent * multiplier) / 100) +
                    bonus;
                return {
                    ruleId: this.id,
                    salaryBasis: award.salaryBasis,
                    quantity: totalQuantity,
                    rate: award.basePercent * multiplier,
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
        return employeeMatchesShopDemandRole(
            context.employee,
            this.targetRole,
            {
                onlineManagerId: item.onlineManagerId,
                offlineManagerId: item.offlineManagerId,
            },
        );
    }

    // Категория — обязательная часть правила (пара «категория × награда»,
    // issue #60); null означает "все товары". Раскрытие до потомков дерева
    // уже сделано application-слоем в erpData.categoryDescendantFolderIds
    // (см. shop-calculation-data.types.ts) — правило лишь сверяет
    // собственный folderId позиции со списком по ключу категории.
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
            // Категория задана, но контекст не принёс её раскрытия —
            // fail closed: лучше недоплатить, чем ошибочно засчитать
            // позицию из другой категории при неполном контексте.
            return false;
        }
        return allowedFolderIds.includes(item.folderId);
    }

    // Дедупликация «правило × позиция» (issue #61) — то же защитное
    // назначение, что у OrderPayedEntity.dedupeBySource сервиса: источник
    // данных в норме отдаёт одну позицию одной строкой, но если по какой-то
    // причине один и тот же positionId попал в выборку дважды (например,
    // из-за пересечения по нескольким совпавшим полям), сумма не должна
    // удвоиться. Это НЕ дедупликация между разными правилами (см. заголовок
    // класса — онлайн- и офлайн-менеджер, даже будучи одним и тем же
    // сотрудником, получают оплату по каждому своему правилу независимо).
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
