import type { CommandBus } from '@nestjs/cqrs';
import type { SalaryAccrualLineFailure } from 'ireports-contracts';
import { ShopSalaryAccrual } from '@/domains/shop/modules/accounting/domain/entities/shop-salary-accrual.entity';
import type { ShopSalaryAccrualEmployeeInfo } from '../mappers/to-shop-salary-accrual-response';
import { unknownShopEmployeeInfo } from '../mappers/to-shop-salary-accrual-response';
import { AccrueShopSalaryAccrualLineCommand } from './accrue-shop-salary-accrual-line.command';

export interface AccrueShopDraftLinesResult {
    accruedLinesCount: number;
    accruedAmount: number;
    failures: SalaryAccrualLineFailure[];
}

// Зеркало domains/service/modules/accounting/application/command/
// accrue-draft-lines.helper.ts (Фаза 6 docs/service-shop-boundary-violations-fix)
// — независимая копия для направления shop. Общий шаг обоих массовых
// проведений (PRD 2, Фаза 7): каждая DRAFT-строка документа проводится
// независимым диспатчем AccrueShopSalaryAccrualLineCommand — в своей
// транзакции UnitOfWork с собственной перечиткой документа.
export async function accrueShopDraftLines(
    commandBus: CommandBus,
    accrual: ShopSalaryAccrual,
    accruedBy: number,
    employees: Map<number, ShopSalaryAccrualEmployeeInfo>,
): Promise<AccrueShopDraftLinesResult> {
    const employeeName = (
        employees.get(accrual.employeeId) ??
        unknownShopEmployeeInfo(accrual.employeeId)
    ).name;
    const result: AccrueShopDraftLinesResult = {
        accruedLinesCount: 0,
        accruedAmount: 0,
        failures: [],
    };
    for (const line of accrual.lines) {
        if (!line.isDraft()) {
            continue;
        }
        try {
            await commandBus.execute(
                new AccrueShopSalaryAccrualLineCommand({
                    accrualId: accrual.id,
                    lineId: line.id,
                    accruedBy,
                }),
            );
            result.accruedLinesCount += 1;
            result.accruedAmount += line.amount;
        } catch (error) {
            result.failures.push({
                accrualId: accrual.id,
                employeeId: accrual.employeeId,
                employeeName,
                lineId: line.id,
                ruleName: line.name,
                message: error instanceof Error ? error.message : String(error),
            });
        }
    }
    return result;
}
