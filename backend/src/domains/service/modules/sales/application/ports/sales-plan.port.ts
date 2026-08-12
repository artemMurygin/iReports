import { SalesPlan } from '../../domain/entities/sales-plan.entity';
import type { SalesDirection } from '../../domain/types/sales-plan.types';

export interface SalesPlanRepositoryPort {
    insert(entity: SalesPlan): Promise<void>;
    update(entity: SalesPlan): Promise<void>;
    delete(id: string): Promise<void>;
    findById(id: string): Promise<SalesPlan | null>;
    findByIds(ids: string[]): Promise<SalesPlan[]>;

    // Естественный ключ строки плана — вход для проверки уникальности при
    // создании (@@unique в sales.prisma — последняя линия защиты, эта
    // проверка ради дружелюбного 409 вместо ошибки БД).
    findByScope(
        direction: SalesDirection,
        department: number,
        category: string | null,
        period: string,
    ): Promise<SalesPlan | null>;

    // Все строки месяца по направлению — вход и для чтения "план месяца"
    // (ListSalesPlansService), и для массового утверждения "весь месяц по
    // направлению" (ApproveSalesPlanHandler).
    findByDirectionAndPeriod(
        direction: SalesDirection,
        period: string,
    ): Promise<SalesPlan[]>;
}

export const SALES_PLAN_REPOSITORY = Symbol('SALES_PLAN_REPOSITORY');
