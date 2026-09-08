// Единица измерения денежных полей модуля accounting — Фаза 7 (см.
// docs/payroll/plan-payroll-calculation.md, "Фаза 7: Правила сервиса").
//
// Решение: целые рубли (Int), без копеек. Основание — уже существующая
// схема: денежные поля RoApp (RoappOrder.payed/cost/engineerSalary/
// managerSalary, RoappService.price/engeneerBonus, RoappServiceOrder.price)
// объявлены как Int в prisma/schema/roapp.prisma, равно как и денежные поля
// самого accounting (AccountingCalculationCache.factTotal/prognoseTotal,
// AccountingPeriodSnapshot.total — prisma/schema/accounting-period.prisma).
// Ни одно из них не хранит копейки отдельным полем и не домножает на 100 —
// значит исходная единица уже рубли, и результат расчёта обязан остаться в
// той же единице, а не завести собственную (копейки/доли) на полпути.
//
// spec: service/accounting#requirement-округление-начислений-до-целого-рубля
export function roundRubles(amount: number): number {
    return Math.round(amount);
}
