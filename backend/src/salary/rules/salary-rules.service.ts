import { Injectable, NotFoundException } from '@nestjs/common';
import { DatabaseService } from '../../database/database.service';
import { RuleStatus } from '../../../prisma/generated/prisma/schema/client';
import { parsePeriod } from '../calculation/period';
import {
  CreateSalaryRuleDto,
  UpdateSalaryRuleDto,
} from './dto/salary-rule.dto';

const includeGoalsAndAssignments = {
  assignments: true,
  goals: { include: { reward: { include: { tiers: true } } } },
};

@Injectable()
export class SalaryRulesService {
  constructor(private readonly db: DatabaseService) {}

  async findAll(filter: { employeeId?: number; period?: string }) {
    const { employeeId, period } = filter;

    const periodFilter = period
      ? (() => {
          const { start, endExclusive } = parsePeriod(period);
          return {
            validFrom: { lt: endExclusive },
            OR: [{ validTo: null }, { validTo: { gte: start } }],
          };
        })()
      : {};

    let assignmentFilter = {};
    if (employeeId != null) {
      const employee = await this.db.bitrixEmployee.findUnique({
        where: { id: employeeId },
      });
      if (!employee) {
        throw new NotFoundException(
          `Сотрудник bitrix_employees#${employeeId} не найден`,
        );
      }
      assignmentFilter = {
        assignments: {
          some: {
            OR: [{ employeeId }, { departmentId: employee.departmentId }],
          },
        },
      };
    }

    return this.db.salaryRule.findMany({
      where: { ...periodFilter, ...assignmentFilter },
      include: includeGoalsAndAssignments,
      orderBy: { id: 'desc' },
    });
  }

  create(dto: CreateSalaryRuleDto) {
    return this.db.salaryRule.create({
      data: {
        name: dto.name,
        payPerHour: dto.payPerHour ?? null,
        isRegular: dto.isRegular,
        validFrom: dto.validFrom,
        validTo: dto.validTo ?? null,
        assignments: { create: dto.assignments },
      },
      include: includeGoalsAndAssignments,
    });
  }

  async update(id: number, dto: UpdateSalaryRuleDto) {
    await this.ensureExists(id);
    return this.db.salaryRule.update({
      where: { id },
      data: dto,
      include: includeGoalsAndAssignments,
    });
  }

  async archive(id: number) {
    await this.ensureExists(id);
    return this.db.salaryRule.update({
      where: { id },
      data: { status: RuleStatus.ARCHIVED },
      include: includeGoalsAndAssignments,
    });
  }

  async remove(id: number) {
    const rule = await this.db.salaryRule.findUnique({
      where: { id },
      include: { goals: { select: { rewardId: true } } },
    });
    if (!rule) throw new NotFoundException(`SalaryRule#${id} не найдено`);
    const rewardIds = rule.goals.map((g) => g.rewardId);
    await this.db.salaryRule.delete({ where: { id } });
    if (rewardIds.length > 0) {
      await this.db.reward.deleteMany({ where: { id: { in: rewardIds } } });
    }
  }

  private async ensureExists(id: number) {
    const rule = await this.db.salaryRule.findUnique({ where: { id } });
    if (!rule) throw new NotFoundException(`SalaryRule#${id} не найдено`);
  }
}
