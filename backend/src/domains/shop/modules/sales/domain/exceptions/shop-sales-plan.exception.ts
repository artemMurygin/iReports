import { ConflictException, NotFoundException } from '@/shared/exceptions';

// Зеркало domains/service/modules/sales/domain/exceptions/
// sales-plan.exception.ts (Фаза 7 docs/service-shop-boundary-violations-fix)
// — независимая копия для направления shop. Повторное создание плана/
// строки шаблона на ту же комбинацию (department, category[, period])
// отклоняется — см. @@unique в sales.prisma (в паре с зафиксированным
// direction: 'shop'), эта проверка дублирует его на уровне приложения ради
// дружелюбного сообщения.
export class ShopSalesPlanAlreadyExistsException extends ConflictException {}

export class ShopSalesPlanNotFoundException extends NotFoundException {
    constructor(message = 'План продаж направления shop не найден') {
        super(message);
    }
}
