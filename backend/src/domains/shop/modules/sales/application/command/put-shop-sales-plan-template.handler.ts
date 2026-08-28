import { Inject } from '@nestjs/common';
import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import type { SalesPlanTemplateResponse } from 'ireports-contracts';
import { PutShopSalesPlanTemplateCommand } from './put-shop-sales-plan-template.command';
import { ShopSalesPlanTemplate } from '../../domain/entities/shop-sales-plan-template.entity';
import { SHOP_SALES_PLAN_TEMPLATE_REPOSITORY } from '../ports/shop-sales-plan-template.port';
import type { ShopSalesPlanTemplateRepositoryPort } from '../ports/shop-sales-plan-template.port';
import { toShopSalesPlanTemplateResponse } from '../mappers/to-shop-sales-plan-template-response';

// Зеркало domains/service/modules/sales/application/command/
// put-sales-plan-template.handler.ts (Фаза 7) — PUT-upsert по естественному
// ключу (department, category) в рамках direction: 'shop'.
@CommandHandler(PutShopSalesPlanTemplateCommand)
export class PutShopSalesPlanTemplateHandler implements ICommandHandler<
    PutShopSalesPlanTemplateCommand,
    SalesPlanTemplateResponse
> {
    constructor(
        @Inject(SHOP_SALES_PLAN_TEMPLATE_REPOSITORY)
        private readonly repo: ShopSalesPlanTemplateRepositoryPort,
    ) {}

    async execute(
        command: PutShopSalesPlanTemplateCommand,
    ): Promise<SalesPlanTemplateResponse> {
        const category = command.category ?? null;
        const existing = await this.repo.findByScope(
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
            return toShopSalesPlanTemplateResponse(existing);
        }

        const template = ShopSalesPlanTemplate.create({
            department: command.department,
            category,
            turnover: command.turnover,
            margin: command.margin,
            orderTypeIds: command.orderTypeIds,
            growthPercent: command.growthPercent,
        });
        await this.repo.insert(template);

        return toShopSalesPlanTemplateResponse(template);
    }
}
