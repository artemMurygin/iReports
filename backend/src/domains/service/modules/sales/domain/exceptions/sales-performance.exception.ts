import { ArgumentInvalidException } from '@/shared/exceptions';

// GetSalesPerformanceService (этот модуль, domains/service/modules/sales) —
// читатель SalesPerformance для направления service, ERP-источник факта
// которого (RoappSalesFactSourceRepository) умеет агрегировать только
// RoappOrder. Направление shop с Фазы 11 обслуживается отдельным читателем
// GetShopSalesPerformanceService (domains/shop/modules/sales) со своим
// ERP-источником по MoySkladDemand — оба читателя мирроят друг друга, но не
// переиспользуют код (см. docs/payroll/plan-payroll-calculation.md, Фаза
// 11). Явный отказ здесь предпочтительнее тихого нулевого факта — на
// случай, если этот сервис ошибочно вызовут напрямую с direction: 'shop'
// вместо SALES_PERFORMANCE_READER/SHOP_SALES_PERFORMANCE_READER своего
// направления, вызывающая сторона узнаёт об ошибке, а не тратит время на
// отладку "почему факт всегда 0".
export class SalesPerformanceDirectionNotSupportedException extends ArgumentInvalidException {
    constructor(direction: string) {
        super(
            `SalesPerformance для направления "${direction}" не поддержан этим читателем — используйте читателя направления "${direction}"`,
        );
    }
}
