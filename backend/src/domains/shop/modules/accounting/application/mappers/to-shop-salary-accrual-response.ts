import type {
    SalaryAccrual as SalaryAccrualContract,
    SalaryAccrualLine as SalaryAccrualLineContract,
    SalaryAccrualResponse,
    TargetRole,
} from 'ireports-contracts';
import { ShopSalaryAccrual } from '@/domains/shop/modules/accounting/domain/entities/shop-salary-accrual.entity';
import { ShopSalaryAccrualLine } from '@/domains/shop/modules/accounting/domain/entities/shop-salary-accrual-line.entity';

// Зеркало domains/service/modules/accounting/application/mappers/
// to-salary-accrual-response.ts (Фаза 6 docs/service-shop-boundary-violations-fix)
// — независимая копия для направления shop.
export interface ShopSalaryAccrualEmployeeInfo {
    name: string;
    departmentId: number | null;
}

export function unknownShopEmployeeInfo(
    employeeId: number,
): ShopSalaryAccrualEmployeeInfo {
    return { name: `Неизвестно (id: ${employeeId})`, departmentId: null };
}

export function toShopSalaryAccrualListItem(
    entity: ShopSalaryAccrual,
    employee: ShopSalaryAccrualEmployeeInfo,
): SalaryAccrualContract {
    return {
        id: entity.id,
        direction: entity.direction,
        period: entity.period,
        employeeId: entity.employeeId,
        employeeName: employee.name,
        departmentId: employee.departmentId,
        status: entity.status,
        isDismissed: entity.isDismissed,
        total: entity.total,
        linesCount: entity.lines.length,
        accruedLinesCount: entity.accruedLinesCount,
        createdAt: entity.createdAt,
    };
}

export function toShopSalaryAccrualResponse(
    entity: ShopSalaryAccrual,
    employee: ShopSalaryAccrualEmployeeInfo,
): SalaryAccrualResponse {
    return {
        ...toShopSalaryAccrualListItem(entity, employee),
        lines: entity.lines.map(toShopSalaryAccrualLineResponse),
    };
}

export function toShopSalaryAccrualLineResponse(
    line: ShopSalaryAccrualLine,
): SalaryAccrualLineContract {
    return {
        id: line.id,
        ruleId: line.ruleId,
        type: line.type,
        name: line.name,
        targetRole: line.targetRole as TargetRole,
        salaryBasis: line.salaryBasis,
        quantity: line.quantity,
        rate: line.rate,
        originalAmount: line.originalAmount,
        amount: line.amount,
        sources: line.sources,
        status: line.status,
        adjustmentComment: line.adjustmentComment ?? null,
    };
}
