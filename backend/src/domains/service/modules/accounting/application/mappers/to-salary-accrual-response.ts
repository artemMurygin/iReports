import type {
    SalaryAccrual as SalaryAccrualContract,
    SalaryAccrualLine as SalaryAccrualLineContract,
    SalaryAccrualResponse,
    TargetRole,
} from 'ireports-contracts';
import { SalaryAccrual } from '@/domains/service/modules/accounting/domain/entities/salary-accrual.entity';
import { SalaryAccrualLine } from '@/domains/service/modules/accounting/domain/entities/salary-accrual-line.entity';

// ФИО и отдел документ не хранит (только employeeId) — резолвятся на чтении
// из справочника Bitrix (modules/directory), тем же приёмом и с тем же
// фолбэком, что и target.name в to-motivation-schema-list-item.ts.
export interface SalaryAccrualEmployeeInfo {
    name: string;
    departmentId: number | null;
}

export function unknownEmployeeInfo(
    employeeId: number,
): SalaryAccrualEmployeeInfo {
    return { name: `Неизвестно (id: ${employeeId})`, departmentId: null };
}

export function toSalaryAccrualListItem(
    entity: SalaryAccrual,
    employee: SalaryAccrualEmployeeInfo,
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

export function toSalaryAccrualResponse(
    entity: SalaryAccrual,
    employee: SalaryAccrualEmployeeInfo,
): SalaryAccrualResponse {
    return {
        ...toSalaryAccrualListItem(entity, employee),
        lines: entity.lines.map(toSalaryAccrualLineResponse),
    };
}

// Экспортирована отдельно: та же форма строки используется раскрытием
// движения начисления в ленте баланса (GetEmployeeBalanceService) — PRD 2:
// «начисление в ленте раскрывается до правила и источников, идентичных
// строке документа начисления».
export function toSalaryAccrualLineResponse(
    line: SalaryAccrualLine,
): SalaryAccrualLineContract {
    return {
        id: line.id,
        ruleId: line.ruleId,
        type: line.type,
        name: line.name,
        // Сущность хранит роль как string (direction-агностична), контракт —
        // как перечисление ролей обоих направлений; строка попала в документ
        // из RuleBreakdownLine правила, чья роль уже прошла targetRoleSchema
        // при создании правила.
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
