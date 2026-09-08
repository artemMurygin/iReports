import { z } from 'zod';

// Статус документа начисления — вынесен в отдельный файл, потому что нужен и
// самому документу (salary-accrual.ts), и отчёту по зарплате сотрудника
// (salary-rule.ts → directionSalaryReportSchema.accrualStatus), а
// salary-accrual.ts сам импортирует calculationLineSchema/targetRoleSchema
// из salary-rule.ts — без этого файла получился бы циклический импорт.
//
// Перечень заложен целиком сразу (PRD 1 docs/payroll-closing-and-accrual:
// "Статусы документа в этом PRD: DRAFT. Переходы ACCRUED / PAID — в PRD 2 и
// 3; перечень статусов закладывается целиком, чтобы не менять контракт"):
// DRAFT — ни одна строка не проведена на баланс, PARTIALLY_ACCRUED — часть
// строк, ACCRUED — все строки проведены («ожидает выплаты»), PAID — выплачен.
const salaryAccrualStatusSchema = z.enum([
    'DRAFT',
    'PARTIALLY_ACCRUED',
    'ACCRUED',
    'PAID',
]);
export type SalaryAccrualStatus = z.infer<typeof salaryAccrualStatusSchema>;

export { salaryAccrualStatusSchema };
