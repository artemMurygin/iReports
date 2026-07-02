import { Injectable } from '@nestjs/common';
import { DatabaseService } from '../../database/database.service';
import {
  Direction,
  KpiStat,
  Scope,
} from '../../../prisma/generated/prisma/schema/client';
import { parsePeriod } from '../calculation/period';
import { collectSubtreeIds, CategoryEdge } from '../calculation/category-tree';
import { castCategoryExtId } from '../calculation/metrics/category-cast';
import { calcServiceOrderMetric } from '../calculation/metrics/service-metrics';
import { calcShopPositionMetric } from '../calculation/metrics/shop-metrics';

function sum(values: number[]): number {
  return values.reduce((a, b) => a + b, 0);
}

type PlanTargetRow = {
  id: number;
  direction: Direction;
  scope: Scope;
  employeeId: number | null;
  departmentId: number | null;
  categoryExtId: string | null;
  stat: KpiStat;
  planValue: number;
};

// Таблица план/факт: план — из БД, факт считается на лету из источников (без витрины),
// с учётом scope (сотрудник конкретный / весь отдел / вся компания).
@Injectable()
export class PlanFactService {
  constructor(private readonly db: DatabaseService) {}

  async getTable(filter: {
    period: string;
    direction?: Direction;
    scope: Scope;
  }) {
    const targets = await this.db.planTarget.findMany({ where: filter });
    const { start, endExclusive } = parsePeriod(filter.period);

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

    const rows = await Promise.all(
      targets.map(async (target) => ({
        ...target,
        factValue: await this.computeFact(
          target,
          start,
          endExclusive,
          loadCategoryTree,
        ),
      })),
    );
    return rows;
  }

  private async resolveCategoryIds(
    target: Pick<PlanTargetRow, 'direction' | 'categoryExtId'>,
    loadCategoryTree: (direction: Direction) => Promise<CategoryEdge[]>,
  ): Promise<(number | string)[] | null> {
    if (!target.categoryExtId) return null;
    const rootId = castCategoryExtId(target.direction, target.categoryExtId);
    const tree = await loadCategoryTree(target.direction);
    return [...collectSubtreeIds(tree, rootId)];
  }

  private async resolveServiceEngineerIds(
    target: Pick<PlanTargetRow, 'scope' | 'employeeId' | 'departmentId'>,
  ): Promise<number[] | null> {
    if (target.scope === Scope.COMPANY) return null;
    if (target.scope === Scope.PERSONAL) {
      const employee = await this.db.bitrixEmployee.findUnique({
        where: { id: target.employeeId! },
      });
      return employee?.roappId != null ? [employee.roappId] : [];
    }
    const employees = await this.db.bitrixEmployee.findMany({
      where: { departmentId: target.departmentId! },
    });
    return employees
      .map((e) => e.roappId)
      .filter((id): id is number => id != null);
  }

  private async resolveShopManagerIds(
    target: Pick<PlanTargetRow, 'scope' | 'employeeId' | 'departmentId'>,
  ): Promise<string[] | null> {
    if (target.scope === Scope.COMPANY) return null;
    if (target.scope === Scope.PERSONAL) {
      const employee = await this.db.bitrixEmployee.findUnique({
        where: { id: target.employeeId! },
      });
      return employee?.moySkladId != null ? [employee.moySkladId] : [];
    }
    const employees = await this.db.bitrixEmployee.findMany({
      where: { departmentId: target.departmentId! },
    });
    return employees
      .map((e) => e.moySkladId)
      .filter((id): id is string => id != null);
  }

  private async computeFact(
    target: PlanTargetRow,
    start: Date,
    endExclusive: Date,
    loadCategoryTree: (direction: Direction) => Promise<CategoryEdge[]>,
  ): Promise<number> {
    const categoryIds = await this.resolveCategoryIds(target, loadCategoryTree);

    if (target.direction === Direction.SERVICE) {
      const engineerIds = await this.resolveServiceEngineerIds(target);
      if (engineerIds !== null && engineerIds.length === 0) return 0;

      const rows = await this.db.roappServiceOrder.findMany({
        where: {
          ...(engineerIds ? { engineerId: { in: engineerIds } } : {}),
          order: { closedAt: { gte: start, lt: endExclusive } },
          ...(categoryIds
            ? { service: { categoryId: { in: categoryIds as number[] } } }
            : {}),
        },
        select: {
          price: true,
          quantity: true,
          discount: true,
          cost: true,
          engeneerSalary: true,
        },
      });
      return sum(rows.map((r) => calcServiceOrderMetric(target.stat, r)));
    }

    const managerIds = await this.resolveShopManagerIds(target);
    if (managerIds !== null && managerIds.length === 0) return 0;

    const rows = await this.db.moySkladDemandPosition.findMany({
      where: {
        demand: {
          moment: { gte: start, lt: endExclusive },
          ...(managerIds
            ? {
                OR: [
                  { onlineManagerId: { in: managerIds } },
                  { offlineManagerId: { in: managerIds } },
                ],
              }
            : {}),
        },
        ...(categoryIds
          ? { product: { folderId: { in: categoryIds as string[] } } }
          : {}),
      },
      select: { sum: true, cost: true, profit: true, quantity: true },
    });
    return sum(rows.map((r) => calcShopPositionMetric(target.stat, r)));
  }
}
