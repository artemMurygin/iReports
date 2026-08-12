import { SalesPlanTemplate } from '../../domain/entities/sales-plan-template.entity';
import type { SalesDirection } from '../../domain/types/sales-plan.types';

export interface SalesPlanTemplateRepositoryPort {
    insert(entity: SalesPlanTemplate): Promise<void>;
    update(entity: SalesPlanTemplate): Promise<void>;

    // Естественный ключ строки шаблона — вход для upsert-семантики PUT
    // /sales/plan_template (см. PutSalesPlanTemplateHandler).
    findByScope(
        direction: SalesDirection,
        department: number,
        category: string | null,
    ): Promise<SalesPlanTemplate | null>;

    findAll(direction?: SalesDirection): Promise<SalesPlanTemplate[]>;
}

export const SALES_PLAN_TEMPLATE_REPOSITORY = Symbol(
    'SALES_PLAN_TEMPLATE_REPOSITORY',
);
