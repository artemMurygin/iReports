import { ShopTaskCompletion } from '@/domains/shop/modules/accounting/domain/entities/shop-task-completion.entity';

export interface ShopTaskCompletionRepositoryPort {
    insert(entity: ShopTaskCompletion): Promise<void>;
    update(entity: ShopTaskCompletion): Promise<void>;
    delete(id: string): Promise<void>;
    findById(id: string): Promise<ShopTaskCompletion | null>;

    // Все записи периода (руководитель видит и подтверждает задачи всех
    // сотрудников месяца) либо только одного сотрудника, если указан.
    findByPeriod(
        period: string,
        employeeId?: number,
    ): Promise<ShopTaskCompletion[]>;

    // Только подтверждённые записи периода — вход
    // BuildShopCalculationContextService (Фаза 13.5, источник для
    // TaskCompletedEntity.calculate() магазина).
    findConfirmedByPeriod(period: string): Promise<ShopTaskCompletion[]>;
}

export const SHOP_TASK_COMPLETION_REPOSITORY = Symbol(
    'SHOP_TASK_COMPLETION_REPOSITORY',
);
