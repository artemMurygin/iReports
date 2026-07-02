import { Injectable, NotFoundException } from '@nestjs/common';
import { DatabaseService } from '../../database/database.service';
import {
  AccrualType,
  Direction,
  GoalType,
  KpiDirection,
  KpiStat,
  ManagerRole,
  Prisma,
  ReportStatus,
  RewardType,
  RuleStatus,
  Scope,
} from '../../../prisma/generated/prisma/schema/client';
import { parsePeriod } from './period';
import { collectSubtreeIds, CategoryEdge } from './category-tree';
import { calcAccrual, RewardConfig } from './reward-calc';
import { progressionCoef, ProgressionTier } from './progression-coef';
import {
  calcServiceOrderMetric,
  ServiceOrderMetricInput,
} from './metrics/service-metrics';
import {
  calcShopPositionMetric,
  ShopPositionMetricInput,
} from './metrics/shop-metrics';
import { castCategoryExtId } from './metrics/category-cast';

type GoalRow = (ServiceOrderMetricInput | ShopPositionMetricInput) & {
  sourceId: string;
};

type LineItemDraft = {
  accrualType: AccrualType;
  goalId: number | null;
  rewardId: number | null;
  sourceType: string | null;
  sourceId: string | null;
  label: string;
  factAmount: number;
  projected: number;
  meta: Record<string, unknown> | null;
};

function sum(values: number[]): number {
  return values.reduce((a, b) => a + b, 0);
}

// Порядок начислений в отчёте: почасовая часть уже добавлена отдельно,
// среди целей — KPI(SERVICE) → KPI(SHOP) → TASK (ARCHITECTURE.md §3.1, шаг 3).
function goalSortKey(goal: { type: GoalType; direction: Direction }): number {
  if (goal.type === GoalType.KPI && goal.direction === Direction.SERVICE)
    return 0;
  if (goal.type === GoalType.KPI && goal.direction === Direction.SHOP) return 1;
  return 2;
}

@Injectable()
export class SalaryCalculationService {
  constructor(private readonly db: DatabaseService) {}

  // Закрытый месяц — неизменный снапшот: правка правил/целей не должна влиять на него.
  async getReport(employeeId: number, period: string) {
    const existing = await this.db.salaryReport.findUnique({
      where: { employeeId_period: { employeeId, period } },
      include: { lineItems: true },
    });
    if (existing?.status === ReportStatus.CLOSED) return existing;

    const result = await this.calculate(employeeId, period);
    return this.persist(employeeId, period, ReportStatus.PROJECTED, result);
  }

  async closeReport(employeeId: number, period: string) {
    const result = await this.calculate(employeeId, period);
    return this.persist(employeeId, period, ReportStatus.CLOSED, result);
  }

  private async persist(
    employeeId: number,
    period: string,
    status: ReportStatus,
    result: {
      factTotal: number;
      projected: number;
      lineItems: LineItemDraft[];
    },
  ) {
    const { factTotal, projected, lineItems } = result;
    return this.db.$transaction(async (tx) => {
      const report = await tx.salaryReport.upsert({
        where: { employeeId_period: { employeeId, period } },
        create: {
          employeeId,
          period,
          status,
          factTotal,
          projected,
          closedAt: status === ReportStatus.CLOSED ? new Date() : null,
        },
        update: {
          status,
          factTotal,
          projected,
          closedAt: status === ReportStatus.CLOSED ? new Date() : null,
        },
      });

      await tx.salaryLineItem.deleteMany({ where: { reportId: report.id } });
      if (lineItems.length > 0) {
        await tx.salaryLineItem.createMany({
          data: lineItems.map((item) => ({
            accrualType: item.accrualType,
            goalId: item.goalId,
            rewardId: item.rewardId,
            sourceType: item.sourceType,
            sourceId: item.sourceId,
            label: item.label,
            factAmount: item.factAmount,
            projected: item.projected,
            meta: (item.meta ?? Prisma.JsonNull) as Prisma.InputJsonValue,
            reportId: report.id,
          })),
        });
      }

      return tx.salaryReport.findUniqueOrThrow({
        where: { id: report.id },
        include: { lineItems: true },
      });
    });
  }

  private async calculate(employeeId: number, period: string) {
    const employee = await this.db.bitrixEmployee.findUnique({
      where: { id: employeeId },
    });
    if (!employee) {
      throw new NotFoundException(
        `Сотрудник bitrix_employees#${employeeId} не найден`,
      );
    }
    const { start, endExclusive } = parsePeriod(period);
    const now = new Date();

    const rules = await this.db.salaryRule.findMany({
      where: {
        status: RuleStatus.ACTIVE,

        validFrom: { lt: endExclusive },
        OR: [{ validTo: null }, { validTo: { gte: start } }],
        assignments: {
          some: {
            OR: [{ employeeId }, { departmentId: employee.departmentId }],
          },
        },
      },
      include: {
        goals: { include: { reward: { include: { tiers: true } } } },
      },
    });

    console.log(rules);

    const shifts = await this.db.workShift.findMany({
      where: { employeeId, date: { gte: start, lt: endExclusive } },
    });
    const totalPlannedHours = sum(shifts.map((s) => s.plannedHours));
    const elapsedPlannedHours = sum(
      shifts.filter((s) => s.date < now).map((s) => s.plannedHours),
    );
    const actualHours = sum(shifts.map((s) => s.actualHours ?? 0));
    // Run-rate по графику работы, а не по календарным дням (ARCHITECTURE.md §3.4).
    const elapsedShare =
      totalPlannedHours > 0 ? elapsedPlannedHours / totalPlannedHours : 0;

    const lineItems: LineItemDraft[] = [];

    for (const rule of rules) {
      if (rule.payPerHour != null) {
        lineItems.push({
          accrualType: AccrualType.HOURLY,
          goalId: null,
          rewardId: null,
          sourceType: 'schedule',
          sourceId: null,
          label: `Почасовая оплата («${rule.name}»)`,
          factAmount: Math.round(rule.payPerHour * actualHours),
          projected: Math.round(rule.payPerHour * totalPlannedHours),
          meta: { payPerHour: rule.payPerHour, actualHours, totalPlannedHours },
        });
      }
    }

    const goals = rules
      .flatMap((rule) => rule.goals)
      .sort(
        (a, b) => goalSortKey(a) - goalSortKey(b) || a.sortOrder - b.sortOrder,
      );

    // Дерево категорий грузим не более раза на направление за весь расчёт отчёта.
    const categoryTreeCache = new Map<Direction, CategoryEdge[]>();
    const loadCategoryTree = async (
      direction: Direction,
    ): Promise<CategoryEdge[]> => {
      const cached = categoryTreeCache.get(direction);
      if (cached) return cached;
      const tree =
        direction === Direction.SERVICE
          ? await this.db.roappServiceCategory.findMany({
              select: { id: true, parentId: true },
            })
          : await this.db.moySkladProductFolder.findMany({
              select: { id: true, parentId: true },
            });
      categoryTreeCache.set(direction, tree);
      return tree;
    };

    for (const goal of goals) {
      if (goal.type === GoalType.TASK) {
        lineItems.push(await this.calcTaskGoal(goal, employeeId, period));
        continue;
      }
      lineItems.push(
        ...(await this.calcKpiGoal(
          goal,
          employee,
          period,
          start,
          endExclusive,
          elapsedShare,
          loadCategoryTree,
        )),
      );
    }

    const adjustments = await this.db.salaryAdjustment.findMany({
      where: { employeeId, period },
    });
    for (const adj of adjustments) {
      lineItems.push({
        accrualType: adj.accrualType,
        goalId: null,
        rewardId: null,
        sourceType: 'manual',
        sourceId: String(adj.id),
        label: adj.reason,
        factAmount: adj.amount,
        projected: adj.amount,
        meta: null,
      });
    }

    const factTotal = Math.round(sum(lineItems.map((l) => l.factAmount)));
    const projected = Math.round(sum(lineItems.map((l) => l.projected)));
    return { factTotal, projected, lineItems };
  }

  private async calcTaskGoal(
    goal: {
      id: number;
      name: string;
      rewardId: number;
      reward: { value: number };
    },
    employeeId: number,
    period: string,
  ): Promise<LineItemDraft> {
    const completion = await this.db.taskCompletion.findUnique({
      where: {
        goalId_employeeId_period: { goalId: goal.id, employeeId, period },
      },
    });
    const completed = completion?.completed ?? false;
    // Задачам не даём авансовый прогноз выполнения — начисляем только по факту отметки.
    const amount = completed ? goal.reward.value : 0;

    return {
      accrualType: AccrualType.BONUS,
      goalId: goal.id,
      rewardId: goal.rewardId,
      sourceType: 'manual',
      sourceId: completion ? String(completion.id) : null,
      label: `Задача «${goal.name}»: ${completed ? 'выполнена' : 'не выполнена'}`,
      factAmount: amount,
      projected: amount,
      meta: { completed },
    };
  }

  private async resolvePlan(
    goal: {
      direction: Direction;
      scope: Scope;
      categoryExtId: string | null;
      measureStat: string | null;
    },
    employee: { id: number; departmentId: number },
    period: string,
  ) {
    const scopeFields =
      goal.scope === Scope.PERSONAL
        ? { employeeId: employee.id, departmentId: null }
        : goal.scope === Scope.DEPARTMENT
          ? { employeeId: null, departmentId: employee.departmentId }
          : { employeeId: null, departmentId: null };

    // findFirst, а не findUnique: Prisma не позволяет искать по составному уникальному
    // ключу через findUnique, когда часть его полей (employeeId/departmentId) — null.
    return this.db.planTarget.findFirst({
      where: {
        period,
        direction: goal.direction,
        scope: goal.scope,
        categoryExtId: goal.categoryExtId,
        stat: goal.measureStat as KpiStat,
        ...scopeFields,
      },
    });
  }

  private async fetchGoalRows(
    goal: { direction: Direction; categoryExtId: string | null; managerRole: ManagerRole },
    employee: { roappId: number | null; moySkladId: string | null; roappOnlineName: string | null },
    start: Date,
    endExclusive: Date,
    loadCategoryTree: (direction: Direction) => Promise<CategoryEdge[]>,
  ): Promise<GoalRow[]> {
    if (goal.direction === Direction.SERVICE) {
      const managerConditions: object[] = [];
      if (goal.managerRole !== ManagerRole.ONLINE && employee.roappId != null) {
        managerConditions.push({ order: { managerId: employee.roappId } });
      }
      if (goal.managerRole !== ManagerRole.OFFLINE && employee.roappOnlineName != null) {
        managerConditions.push({ order: { onlineManager: employee.roappOnlineName } });
      }
      if (managerConditions.length === 0) return [];

      let categoryIds: number[] | null = null;
      if (goal.categoryExtId) {
        const rootId = castCategoryExtId(Direction.SERVICE, goal.categoryExtId) as number;
        const tree = await loadCategoryTree(Direction.SERVICE);
        categoryIds = [...collectSubtreeIds(tree, rootId)] as number[];
      }

      const rows = await this.db.roappServiceOrder.findMany({
        where: {
          OR: managerConditions,
          order: { closedAt: { gte: start, lt: endExclusive } },
          ...(categoryIds ? { service: { categoryId: { in: categoryIds } } } : {}),
        },
        select: {
          orderId: true,
          price: true,
          quantity: true,
          discount: true,
          cost: true,
          engeneerSalary: true,
        },
      });
      return rows.map((r) => ({
        price: r.price,
        quantity: r.quantity,
        discount: r.discount,
        cost: r.cost,
        engeneerSalary: r.engeneerSalary,
        sourceId: String(r.orderId),
      }));
    }

    const demandManagerConditions: object[] = [];
    if (goal.managerRole !== ManagerRole.ONLINE && employee.moySkladId != null) {
      demandManagerConditions.push({ offlineManagerId: employee.moySkladId });
    }
    if (goal.managerRole !== ManagerRole.OFFLINE && employee.moySkladId != null) {
      demandManagerConditions.push({ onlineManagerId: employee.moySkladId });
    }
    if (demandManagerConditions.length === 0) return [];

    let categoryIds: string[] | null = null;
    if (goal.categoryExtId) {
      const rootId = castCategoryExtId(Direction.SHOP, goal.categoryExtId) as string;
      const tree = await loadCategoryTree(Direction.SHOP);
      categoryIds = [...collectSubtreeIds(tree, rootId)] as string[];
    }

    const rows = await this.db.moySkladDemandPosition.findMany({
      where: {
        demand: {
          moment: { gte: start, lt: endExclusive },
          OR: demandManagerConditions,
        },
        ...(categoryIds ? { product: { folderId: { in: categoryIds } } } : {}),
      },
      select: {
        demandId: true,
        sum: true,
        cost: true,
        profit: true,
        quantity: true,
      },
    });
    return rows.map((r) => ({
      sum: r.sum,
      cost: r.cost,
      profit: r.profit,
      quantity: r.quantity,
      sourceId: r.demandId,
    }));
  }

  private async calcKpiGoal(
    goal: {
      id: number;
      name: string;
      direction: Direction;
      scope: Scope;
      kpiDirection: KpiDirection | null;
      measureStat: string | null;
      categoryExtId: string | null;
      managerRole: ManagerRole;
      rewardId: number;
      reward: {
        name: string;
        type: RewardType;
        value: number;
        baseStat: string | null;
        minAmount: number | null;
        maxAmount: number | null;
        tiers: ProgressionTier[];
      };
    },
    employee: {
      id: number;
      departmentId: number;
      roappId: number | null;
      moySkladId: string | null;
      roappOnlineName: string | null;
    },
    period: string,
    start: Date,
    endExclusive: Date,
    elapsedShare: number,
    loadCategoryTree: (direction: Direction) => Promise<CategoryEdge[]>,
  ): Promise<LineItemDraft[]> {
    if (goal.kpiDirection === KpiDirection.TURNOVER) {
      // Нет данных об остатках (пока не подключена интеграция МойСклад) — не начисляем.
      return [
        {
          accrualType: AccrualType.BONUS,
          goalId: goal.id,
          rewardId: goal.rewardId,
          sourceType: null,
          sourceId: null,
          label: `Оборачиваемость «${goal.name}»: нет данных`,
          factAmount: 0,
          projected: 0,
          meta: { status: 'NO_DATA' },
        },
      ];
    }

    const plan = await this.resolvePlan(goal, employee, period);
    const rows = await this.fetchGoalRows(
      goal,
      employee,
      start,
      endExclusive,
      loadCategoryTree,
    );

    const calcMetric = (stat: KpiStat, row: GoalRow): number =>
      goal.direction === Direction.SERVICE
        ? calcServiceOrderMetric(stat, row as ServiceOrderMetricInput)
        : calcShopPositionMetric(stat, row as ShopPositionMetricInput);
    const measureStat = goal.measureStat as KpiStat;
    const baseStat = (goal.reward.baseStat ?? goal.measureStat) as KpiStat;

    const factValue = sum(rows.map((r) => calcMetric(measureStat, r)));
    const baseValues = rows.map((r) => calcMetric(baseStat, r));
    const baseValueAggregate = sum(baseValues);

    const planValue = plan?.planValue ?? 0;
    const factPct = planValue > 0 ? (factValue / planValue) * 100 : 0;
    const projectedFactValue =
      elapsedShare > 0 ? factValue / elapsedShare : factValue;
    const projectedBaseValueAggregate =
      elapsedShare > 0 ? baseValueAggregate / elapsedShare : baseValueAggregate;
    const projectedPct =
      planValue > 0 ? (projectedFactValue / planValue) * 100 : 0;

    const reward: RewardConfig = {
      type: goal.reward.type,
      value: goal.reward.value,
      minAmount: goal.reward.minAmount,
      maxAmount: goal.reward.maxAmount,
    };
    const tiers = goal.reward.tiers;

    const items: LineItemDraft[] = [];
    let goalFactTotal = 0;

    if (goal.reward.type === RewardType.PERCENT) {
      // % от базы считается на каждый заказ/продажу отдельно — так каждая строка аудируема.
      rows.forEach((row, i) => {
        const accrual = calcAccrual(reward, tiers, factPct, baseValues[i]);
        goalFactTotal += accrual;
        items.push({
          accrualType: AccrualType.BONUS,
          goalId: goal.id,
          rewardId: goal.rewardId,
          sourceType:
            goal.direction === Direction.SERVICE
              ? 'roapp_order'
              : 'moysklad_demand',
          sourceId: row.sourceId,
          label: `${goal.reward.name} по цели «${goal.name}»`,
          factAmount: accrual,
          projected: accrual,
          meta: {
            factPct,
            coef: progressionCoef(factPct, tiers),
            base: baseValues[i],
          },
        });
      });
    } else {
      // FIX — фиксированный бонус за выполнение цели, не привязан к конкретному заказу.
      const accrual = calcAccrual(reward, tiers, factPct, 0);
      goalFactTotal = accrual;
      items.push({
        accrualType: AccrualType.BONUS,
        goalId: goal.id,
        rewardId: goal.rewardId,
        sourceType: null,
        sourceId: null,
        label: `${goal.reward.name} по цели «${goal.name}» (факт)`,
        factAmount: accrual,
        projected: accrual,
        meta: {
          planValue,
          factValue,
          factPct,
          coef: progressionCoef(factPct, tiers),
        },
      });
    }

    // Уже реализованные строки не растут дальше — прогноз добавляется отдельной строкой
    // как ожидаемый довесок до конца месяца (report.projected = Σ line.projected остаётся корректным).
    const projectedGoalTotal = calcAccrual(
      reward,
      tiers,
      projectedPct,
      goal.reward.type === RewardType.PERCENT ? projectedBaseValueAggregate : 0,
    );
    items.push({
      accrualType: AccrualType.BONUS,
      goalId: goal.id,
      rewardId: goal.rewardId,
      sourceType: null,
      sourceId: null,
      label: `Прогноз по цели «${goal.name}» (оставшаяся часть месяца)`,
      factAmount: 0,
      projected: projectedGoalTotal - goalFactTotal,
      meta: { planValue, factValue, factPct, projectedPct, projectedGoalTotal },
    });

    return items;
  }
}
