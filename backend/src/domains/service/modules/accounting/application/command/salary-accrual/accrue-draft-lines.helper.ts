import type { CommandBus } from '@nestjs/cqrs';
import type { SalaryAccrualLineFailure } from 'ireports-contracts';
import { SalaryAccrual } from '@/domains/service/modules/accounting/domain/entities/salary-accrual/salary-accrual.entity';
import type { SalaryAccrualEmployeeInfo } from '@/domains/service/modules/accounting/infrastructure/mappers/salary-accrual/salary-accrual.mapper';
import { SalaryAccrualMapper } from '@/domains/service/modules/accounting/infrastructure/mappers/salary-accrual/salary-accrual.mapper';
import { AccrueSalaryAccrualLineCommand } from './accrue-salary-accrual-line.command';

export interface AccrueDraftLinesResult {
    accruedLinesCount: number;
    // Действующая сумма (line.amount) проведённых этой операцией строк —
    // для статистики «Начислено N документов на X ₽».
    accruedAmount: number;
    failures: SalaryAccrualLineFailure[];
}

// Общий шаг обоих массовых проведений (PRD 2, Фаза 7): каждая DRAFT-строка
// документа проводится независимым диспатчем AccrueSalaryAccrualLineCommand
// — то есть в СВОЕЙ транзакции UnitOfWork с собственной перечиткой
// документа из репозитория. Частичный сбой не оставляет половину строк
// проведёнными без записи об ошибке: упавшая строка целиком откатывается
// (движение + статус) и попадает в перечень failures, остальные строки
// операции продолжаются. Ошибка любой природы (доменный конфликт, отказ
// БД) фиксируется текстом — модалка результата показывает «ФИО, правило,
// текст ошибки» (P2.1).
export async function accrueDraftLines(
    commandBus: CommandBus,
    accrual: SalaryAccrual,
    accruedBy: number,
    employees: Map<number, SalaryAccrualEmployeeInfo>,
): Promise<AccrueDraftLinesResult> {
    const employeeName = (
        employees.get(accrual.employeeId) ??
        SalaryAccrualMapper.unknownEmployeeInfo(accrual.employeeId)
    ).name;
    const result: AccrueDraftLinesResult = {
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
                new AccrueSalaryAccrualLineCommand({
                    direction: accrual.direction,
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
