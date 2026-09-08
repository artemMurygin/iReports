import { Inject } from '@nestjs/common';
import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import type { SalesPlanTemplateResponse } from 'ireports-contracts';
import { PutSalesPlanTemplateCommand } from './put-sales-plan-template.command';
import { SalesPlanTemplate } from '../../domain/entities/sales-plan-template.entity';
import { SALES_PLAN_TEMPLATE_REPOSITORY } from '../ports/sales-plan-template.port';
import type { SalesPlanTemplateRepositoryPort } from '../ports/sales-plan-template.port';
import { toSalesPlanTemplateResponse } from '../mappers/to-sales-plan-template-response';

// PUT — upsert по естественному ключу (direction, department, category):
// первая правка комбинации создаёт строку шаблона, повторная — правит уже
// существующую. Отдельного POST на создание строки шаблона нет (см.
// contracts/commands/sales-plan.ts).
@CommandHandler(PutSalesPlanTemplateCommand)
export class PutSalesPlanTemplateHandler implements ICommandHandler<
    PutSalesPlanTemplateCommand,
    SalesPlanTemplateResponse
> {
    constructor(
        @Inject(SALES_PLAN_TEMPLATE_REPOSITORY)
        private readonly repo: SalesPlanTemplateRepositoryPort,
    ) {}

    async execute(
        command: PutSalesPlanTemplateCommand,
    ): Promise<SalesPlanTemplateResponse> {
        const category = command.category ?? null;
        const existing = await this.repo.findByScope(
            command.direction,
            command.department,
            category,
        );

        if (existing) {
            existing.update({
                turnover: command.turnover,
                margin: command.margin,
                orderTypeIds: command.orderTypeIds,
                growthPercent: command.growthPercent,
            });
            await this.repo.update(existing);
            return toSalesPlanTemplateResponse(existing);
        }

        const template = SalesPlanTemplate.create({
            direction: command.direction,
            department: command.department,
            category,
            turnover: command.turnover,
            margin: command.margin,
            orderTypeIds: command.orderTypeIds,
            growthPercent: command.growthPercent,
        });
        await this.repo.insert(template);

        return toSalesPlanTemplateResponse(template);
    }
}
