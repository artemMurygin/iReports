import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { DatabaseService } from '../database/database.service';
import {
  CreateDirectionDto,
  CreateTargetDto,
  UpdateTargetDto,
  CreateScaleDto,
  CreatePointDto,
  UpdatePointDto,
  CreateMotivationRuleDto,
  UpdateMotivationRuleDto,
  CreateRuleItemDto,
  UpdateRuleItemDto,
  CreatePlanDto,
  UpdatePlanDto,
  CreateFactDto,
  UpdateFactDto,
  CreateEmployeeRuleDto,
  MotivationQueryDto,
} from './dto';

@Injectable()
export class SalaryReportService {
  constructor(private readonly db: DatabaseService) {}

  // ── Направления ──────────────────────────────────────────────────────────

  findAllDirections() {
    return this.db.salaryReportDirection.findMany({ orderBy: { id: 'asc' } });
  }

  createDirection(dto: CreateDirectionDto) {
    return this.db.salaryReportDirection.create({ data: dto });
  }

  // ── Цели ─────────────────────────────────────────────────────────────────

  findAllTargets(directionId?: number) {
    return this.db.salaryReportTarget.findMany({
      where: directionId ? { directionId } : undefined,
      include: {
        direction: true,
        moySkladFolder: { select: { id: true, name: true } },
        roappServiceCategory: { select: { id: true, name: true } },
        roappProductCategory: { select: { id: true, name: true } },
      },
      orderBy: { id: 'asc' },
    });
  }

  createTarget(dto: CreateTargetDto) {
    return this.db.salaryReportTarget.create({
      data: {
        directionId: dto.directionId,
        metric: dto.metric,
        moySkladFolderId: dto.moySkladFolderId ?? null,
        roappServiceCategoryId: dto.roappServiceCategoryId ?? null,
        roappProductCategoryId: dto.roappProductCategoryId ?? null,
      },
      include: { direction: true },
    });
  }

  updateTarget(id: number, dto: UpdateTargetDto) {
    return this.db.salaryReportTarget.update({ where: { id }, data: dto });
  }

  removeTarget(id: number) {
    return this.db.salaryReportTarget.delete({ where: { id } });
  }

  // ── Шкалы коэффициентов ──────────────────────────────────────────────────

  findAllScales() {
    return this.db.salaryReportCoefficientScale.findMany({
      include: { points: { orderBy: { fulfillmentPct: 'asc' } } },
      orderBy: { id: 'asc' },
    });
  }

  createScale(dto: CreateScaleDto) {
    return this.db.salaryReportCoefficientScale.create({ data: dto });
  }

  removeScale(id: number) {
    return this.db.salaryReportCoefficientScale.delete({ where: { id } });
  }

  findScalePoints(scaleId: number) {
    return this.db.salaryReportCoefficientPoint.findMany({
      where: { scaleId },
      orderBy: { fulfillmentPct: 'asc' },
    });
  }

  createPoint(scaleId: number, dto: CreatePointDto) {
    return this.db.salaryReportCoefficientPoint.create({
      data: { scaleId, fulfillmentPct: dto.fulfillmentPct, coefficient: dto.coefficient },
    });
  }

  updatePoint(id: number, dto: UpdatePointDto) {
    return this.db.salaryReportCoefficientPoint.update({ where: { id }, data: dto });
  }

  removePoint(id: number) {
    return this.db.salaryReportCoefficientPoint.delete({ where: { id } });
  }

  // ── Правила мотивации ─────────────────────────────────────────────────────

  findAllRules(directionId?: number) {
    return this.db.salaryReportMotivationRule.findMany({
      where: directionId ? { directionId } : undefined,
      include: {
        direction: true,
        scale: { include: { points: { orderBy: { fulfillmentPct: 'asc' } } } },
        items: {
          include: {
            target: {
              include: {
                direction: true,
                moySkladFolder: { select: { id: true, name: true } },
                roappServiceCategory: { select: { id: true, name: true } },
                roappProductCategory: { select: { id: true, name: true } },
              },
            },
          },
        },
      },
      orderBy: { id: 'asc' },
    });
  }

  async ensureTarget(dto: CreateTargetDto) {
    const existing = await this.db.salaryReportTarget.findFirst({
      where: {
        directionId: dto.directionId,
        metric: dto.metric,
        moySkladFolderId: dto.moySkladFolderId ?? null,
        roappServiceCategoryId: dto.roappServiceCategoryId ?? null,
        roappProductCategoryId: dto.roappProductCategoryId ?? null,
      },
      include: { direction: true },
    });
    if (existing) return existing;
    return this.createTarget(dto);
  }

  findMoySkladFolders() {
    return this.db.moySkladProductFolder.findMany({
      where: { archived: false },
      select: { id: true, name: true, pathName: true, parentId: true },
      orderBy: { pathName: 'asc' },
    });
  }

  findRoappServiceCategories() {
    return this.db.roappServiceCategory.findMany({
      select: { id: true, name: true, parentId: true, depth: true },
      orderBy: [{ depth: 'asc' }, { name: 'asc' }],
    });
  }

  findRoappProductCategories() {
    return this.db.roappProductCategory.findMany({
      select: { id: true, name: true, parentId: true },
      orderBy: { name: 'asc' },
    });
  }

  createRule(dto: CreateMotivationRuleDto) {
    return this.db.salaryReportMotivationRule.create({
      data: {
        name: dto.name,
        directionId: dto.directionId,
        scaleId: dto.scaleId,
        payoutBase: dto.payoutBase,
        effectiveFrom: dto.effectiveFrom ?? null,
      },
      include: { direction: true, scale: true },
    });
  }

  updateRule(id: number, dto: UpdateMotivationRuleDto) {
    return this.db.salaryReportMotivationRule.update({ where: { id }, data: dto });
  }

  removeRule(id: number) {
    return this.db.salaryReportMotivationRule.delete({ where: { id } });
  }

  // ── Строки правила ────────────────────────────────────────────────────────

  findRuleItems(ruleId: number) {
    return this.db.salaryReportRuleItem.findMany({
      where: { ruleId },
      include: {
        target: {
          include: {
            moySkladFolder: { select: { id: true, name: true } },
            roappServiceCategory: { select: { id: true, name: true } },
            roappProductCategory: { select: { id: true, name: true } },
          },
        },
      },
    });
  }

  createRuleItem(ruleId: number, dto: CreateRuleItemDto) {
    return this.db.salaryReportRuleItem.create({
      data: { ruleId, targetId: dto.targetId, basePercent: dto.basePercent },
    });
  }

  updateRuleItem(id: number, dto: UpdateRuleItemDto) {
    return this.db.salaryReportRuleItem.update({ where: { id }, data: dto });
  }

  removeRuleItem(id: number) {
    return this.db.salaryReportRuleItem.delete({ where: { id } });
  }

  // ── План ──────────────────────────────────────────────────────────────────

  findPlans(period?: Date, directionId?: number) {
    return this.db.salaryReportPlan.findMany({
      where: {
        ...(period ? { period } : {}),
        ...(directionId ? { target: { directionId } } : {}),
      },
      include: { target: { include: { direction: true } } },
      orderBy: [{ target: { directionId: 'asc' } }, { period: 'asc' }],
    });
  }

  createPlan(dto: CreatePlanDto) {
    return this.db.salaryReportPlan.create({
      data: { targetId: dto.targetId, period: dto.period, value: dto.value },
    });
  }

  updatePlan(id: number, dto: UpdatePlanDto) {
    return this.db.salaryReportPlan.update({ where: { id }, data: dto });
  }

  removePlan(id: number) {
    return this.db.salaryReportPlan.delete({ where: { id } });
  }

  // ── Факт ──────────────────────────────────────────────────────────────────

  findFacts(period?: Date, directionId?: number) {
    return this.db.salaryReportFact.findMany({
      where: {
        ...(period ? { period } : {}),
        ...(directionId ? { target: { directionId } } : {}),
      },
      include: { target: { include: { direction: true } } },
      orderBy: [{ target: { directionId: 'asc' } }, { period: 'asc' }],
    });
  }

  createFact(dto: CreateFactDto) {
    return this.db.salaryReportFact.create({
      data: {
        targetId: dto.targetId,
        period: dto.period,
        value: dto.value,
        source: dto.source,
        syncedAt: dto.source !== 'manual' ? new Date() : null,
      },
    });
  }

  updateFact(id: number, dto: UpdateFactDto) {
    return this.db.salaryReportFact.update({ where: { id }, data: dto });
  }

  removeFact(id: number) {
    return this.db.salaryReportFact.delete({ where: { id } });
  }

  // ── Привязка сотрудников к правилам ───────────────────────────────────────

  findEmployeeRules(ruleId?: number) {
    return this.db.salaryReportEmployeeRule.findMany({
      where: ruleId ? { ruleId } : undefined,
      include: {
        rule: { select: { id: true, name: true } },
        bitrixEmployee: true,
        bitrixDepartment: true,
      },
    });
  }

  async createEmployeeRule(dto: CreateEmployeeRuleDto) {
    if (!dto.bitrixEmployeeId && !dto.bitrixDepartmentId) {
      throw new BadRequestException('Необходимо указать сотрудника или отдел');
    }
    if (dto.bitrixEmployeeId && dto.bitrixDepartmentId) {
      throw new BadRequestException('Можно указать только сотрудника ИЛИ отдел');
    }
    return this.db.salaryReportEmployeeRule.create({
      data: {
        ruleId: dto.ruleId,
        bitrixEmployeeId: dto.bitrixEmployeeId ?? null,
        bitrixDepartmentId: dto.bitrixDepartmentId ?? null,
        effectiveFrom: dto.effectiveFrom,
        effectiveTo: dto.effectiveTo ?? null,
      },
    });
  }

  removeEmployeeRule(id: number) {
    return this.db.salaryReportEmployeeRule.delete({ where: { id } });
  }

  // ── Расчёт мотивации ──────────────────────────────────────────────────────

  async getMotivation(query: MotivationQueryDto) {
    const { period, ruleId } = query;

    const rules = await this.db.salaryReportMotivationRule.findMany({
      where: ruleId ? { id: ruleId } : undefined,
      include: {
        direction: true,
        scale: { include: { points: { orderBy: { fulfillmentPct: 'asc' } } } },
        items: {
          include: {
            target: {
              include: {
                moySkladFolder: { select: { id: true, name: true } },
                roappServiceCategory: { select: { id: true, name: true } },
                roappProductCategory: { select: { id: true, name: true } },
              },
            },
          },
        },
      },
    });

    const today = new Date();
    const periodDate = new Date(period);
    const daysInMonth = new Date(periodDate.getFullYear(), periodDate.getMonth() + 1, 0).getDate();
    const daysPassed =
      today.getFullYear() === periodDate.getFullYear() &&
      today.getMonth() === periodDate.getMonth()
        ? today.getDate()
        : today > periodDate
          ? daysInMonth
          : 0;

    const result: Record<string, unknown>[] = [];

    for (const rule of rules) {
      const points = rule.scale.points.map((p) => ({
        fulfillmentPct: Number(p.fulfillmentPct),
        coefficient: Number(p.coefficient),
      }));

      for (const item of rule.items) {
        const [plan, fact] = await Promise.all([
          this.db.salaryReportPlan.findUnique({
            where: { targetId_period: { targetId: item.targetId, period } },
          }),
          this.db.salaryReportFact.findUnique({
            where: { targetId_period: { targetId: item.targetId, period } },
          }),
        ]);

        const planValue = plan ? Number(plan.value) : null;
        const factValue = fact ? Number(fact.value) : null;

        const fulfillment =
          planValue && planValue > 0 && factValue !== null
            ? factValue / planValue
            : null;
        const coefficient = fulfillment !== null ? calcCoefficient(points, fulfillment) : null;
        const factPercent =
          coefficient !== null ? Number(item.basePercent) * coefficient : null;

        const forecastValue =
          daysPassed > 0 && factValue !== null
            ? (factValue / daysPassed) * daysInMonth
            : null;
        const forecastFulfillment =
          planValue && planValue > 0 && forecastValue !== null
            ? forecastValue / planValue
            : null;
        const forecastCoefficient =
          forecastFulfillment !== null
            ? calcCoefficient(points, forecastFulfillment)
            : null;
        const forecastPercent =
          forecastCoefficient !== null
            ? Number(item.basePercent) * forecastCoefficient
            : null;

        const target = item.target;
        const targetName =
          target.moySkladFolder?.name ??
          target.roappServiceCategory?.name ??
          target.roappProductCategory?.name ??
          `${rule.direction.name} (всё направление)`;

        result.push({
          ruleId: rule.id,
          ruleName: rule.name,
          directionName: rule.direction.name,
          targetId: item.targetId,
          targetName,
          metric: target.metric,
          period: periodDate.toISOString().slice(0, 10),
          planValue,
          factValue,
          basePercent: Number(item.basePercent),
          daysPassed,
          daysInMonth,
          fulfillment: round(fulfillment, 4),
          coefficient: round(coefficient, 4),
          factPercent: round(factPercent, 4),
          forecastValue: round(forecastValue, 2),
          forecastFulfillment: round(forecastFulfillment, 4),
          forecastCoefficient: round(forecastCoefficient, 4),
          forecastPercent: round(forecastPercent, 4),
        });
      }
    }

    return result;
  }

  // ── Результаты ────────────────────────────────────────────────────────────

  findResults(period?: Date) {
    return this.db.salaryReportResult.findMany({
      where: period ? { period } : undefined,
      include: { rule: { select: { id: true, name: true } }, bitrixEmployee: true },
      orderBy: { period: 'desc' },
    });
  }

  // ── Сид с моковыми данными ────────────────────────────────────────────────

  async seed() {
    // Directions
    const [shop, service] = await Promise.all([
      this.db.salaryReportDirection.upsert({
        where: { name: 'Магазин' },
        create: { name: 'Магазин' },
        update: {},
      }),
      this.db.salaryReportDirection.upsert({
        where: { name: 'Сервис' },
        create: { name: 'Сервис' },
        update: {},
      }),
    ]);

    // Coefficient scale
    const scale = await this.db.salaryReportCoefficientScale.create({
      data: {
        name: 'Базовая шкала',
        points: {
          create: [
            { fulfillmentPct: 0.7, coefficient: 0.5 },
            { fulfillmentPct: 1.2, coefficient: 1.2 },
          ],
        },
      },
    });

    // Targets: whole direction for both
    const [shopTarget, serviceTarget] = await Promise.all([
      this.db.salaryReportTarget.create({
        data: { directionId: shop.id, metric: 'revenue' },
      }),
      this.db.salaryReportTarget.create({
        data: { directionId: service.id, metric: 'revenue' },
      }),
    ]);

    // Motivation rules
    const [shopRule, serviceRule] = await Promise.all([
      this.db.salaryReportMotivationRule.create({
        data: {
          name: 'Магазин 2026',
          directionId: shop.id,
          scaleId: scale.id,
          payoutBase: 'margin',
          effectiveFrom: new Date('2026-01-01'),
          items: {
            create: [{ targetId: shopTarget.id, basePercent: 0.1 }],
          },
        },
      }),
      this.db.salaryReportMotivationRule.create({
        data: {
          name: 'Сервис 2026',
          directionId: service.id,
          scaleId: scale.id,
          payoutBase: 'margin',
          effectiveFrom: new Date('2026-01-01'),
          items: {
            create: [{ targetId: serviceTarget.id, basePercent: 0.1 }],
          },
        },
      }),
    ]);

    // Plan & Fact for June 2026
    const june = new Date('2026-06-01');
    await Promise.all([
      this.db.salaryReportPlan.createMany({
        data: [
          { targetId: shopTarget.id, period: june, value: 500000 },
          { targetId: serviceTarget.id, period: june, value: 800000 },
        ],
        skipDuplicates: true,
      }),
      this.db.salaryReportFact.createMany({
        data: [
          { targetId: shopTarget.id, period: june, value: 600000, source: 'moy_sklad' },
          { targetId: serviceTarget.id, period: june, value: 760000, source: 'roapp' },
        ],
        skipDuplicates: true,
      }),
    ]);

    return {
      directions: [shop, service],
      scale,
      rules: [shopRule, serviceRule],
      targets: [shopTarget, serviceTarget],
    };
  }
}

// ── Вспомогательные функции ────────────────────────────────────────────────

function calcCoefficient(
  points: { fulfillmentPct: number; coefficient: number }[],
  fulfillment: number,
): number {
  if (points.length === 0) return 1;

  const lo = [...points].filter((p) => p.fulfillmentPct <= fulfillment).at(-1);
  const hi = points.find((p) => p.fulfillmentPct >= fulfillment);

  if (!lo) return hi!.coefficient;
  if (!hi) return lo.coefficient;
  if (lo.fulfillmentPct === hi.fulfillmentPct) return lo.coefficient;

  return (
    lo.coefficient +
    ((fulfillment - lo.fulfillmentPct) / (hi.fulfillmentPct - lo.fulfillmentPct)) *
      (hi.coefficient - lo.coefficient)
  );
}

function round(value: number | null | undefined, decimals: number): number | null {
  if (value === null || value === undefined) return null;
  const factor = Math.pow(10, decimals);
  return Math.round(value * factor) / factor;
}
