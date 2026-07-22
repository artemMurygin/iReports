import { Injectable, Logger } from '@nestjs/common';
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
import { realpath, writeFileSync } from 'node:fs';

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
  private readonly logger = new Logger(PlanFactService.name);

  constructor(private readonly db: DatabaseService) {}

  async getTable(filter: {
    period: string;
    scope?: Scope;
    employeeIds?: number[];
    departmentIds?: number[];
  }) {
    const targets = await this.db.planTarget.findMany({
      where: {
        period: filter.period,
        ...(filter.scope ? { scope: filter.scope } : {}),
        ...(filter.employeeIds?.length
          ? { employeeId: { in: filter.employeeIds } }
          : {}),
        ...(filter.departmentIds?.length
          ? { departmentId: { in: filter.departmentIds } }
          : {}),
      },
    });

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
    if (!target.categoryExtId) {
      return null;
    }
    const rootId = castCategoryExtId(target.direction, target.categoryExtId);
    const tree = await loadCategoryTree(target.direction);
    const ids = [...collectSubtreeIds(tree, rootId)];

    return ids;
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
    if (target.scope === Scope.COMPANY) {
      this.logger.debug(
        'resolveShopManagerIds: scope=COMPANY -> без фильтра по менеджеру',
      );
      return null;
    }
    if (target.scope === Scope.PERSONAL) {
      const employee = await this.db.bitrixEmployee.findUnique({
        where: { id: target.employeeId! },
      });
      const ids = employee?.moySkladId != null ? [employee.moySkladId] : [];
      this.logger.debug(
        `resolveShopManagerIds: scope=PERSONAL employeeId=${target.employeeId} ` +
          `bitrixEmployee.moySkladId=${employee?.moySkladId ?? 'null'} -> managerIds=${JSON.stringify(ids)}`,
      );
      if (employee && employee.moySkladId == null) {
        this.logger.warn(
          `resolveShopManagerIds: у сотрудника employeeId=${target.employeeId} не заполнен moySkladId ` +
            `-> факт по МойСклад для него всегда будет 0`,
        );
      }
      return ids;
    }
    const employees = await this.db.bitrixEmployee.findMany({
      where: { departmentId: target.departmentId! },
    });
    const ids = employees
      .map((e) => e.moySkladId)
      .filter((id): id is string => id != null);
    this.logger.debug(
      `resolveShopManagerIds: scope=DEPARTMENT departmentId=${target.departmentId} ` +
        `сотрудников=${employees.length} с moySkladId=${ids.length} -> managerIds=${JSON.stringify(ids)}`,
    );
    return ids;
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
      if (engineerIds !== null && engineerIds.length === 0) {
        return 0;
      }
      console.log('Дата start', start);
      console.log('Дата endExclusive', endExclusive);
      const rows = await this.db.roappServiceOrder.findMany({
        where: {
          order: {
            closedAt: { gte: start, lt: endExclusive },
            orderTypeId: 17199,
          },
        },
        select: {
          orderId: true,
          price: true,
          quantity: true,
          discount: true,
          cost: true,
          engeneerSalary: true,
          order: {
            select: {
              label: true,
            },
          },
        },
      });
      const orders = new Array(...new Set(rows.map((i) => i.order.label)));
      const ordersfromDB = await this.db.roappOrder.findMany({
        where: {
          payed: { gt: 0 },
          closedAt: { gte: start, lt: endExclusive },
        },
      });
      console.log(orders.length);
      console.log('из дб' + ordersfromDB.map((i) => i.label));
      const factValue = sum(
        rows.map((r) => calcServiceOrderMetric(target.stat, r)),
      );

      return factValue;
    }

    const managerIds = await this.resolveShopManagerIds(target);
    if (managerIds !== null && managerIds.length === 0) {
      return 0;
    }

    const rows = await this.db.moySkladDemandPosition.findMany({
      where: {
        demand: { moment: { gte: start, lt: endExclusive } },
        ...(categoryIds
          ? {
              OR: [
                { product: { folderId: { in: categoryIds as string[] } } },
                { service: { folderId: { in: categoryIds as string[] } } },
              ],
            }
          : {}),
      },
      select: { sum: true, cost: true, profit: true, quantity: true },
    });
    const factValue = sum(
      rows.map((r) => calcShopPositionMetric(target.stat, r)),
    );
    return factValue;
  }
}
