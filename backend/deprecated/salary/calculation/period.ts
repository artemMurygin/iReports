export type PeriodRange = { start: Date; endExclusive: Date };

// 'YYYY-MM' -> границы месяца. endExclusive — первое число следующего месяца
// (использовать с `lt`, не `lte`, чтобы не зависеть от времени суток источника).
export function parsePeriod(period: string): PeriodRange {
  const [year, month] = period.split('-').map(Number);
  return {
    start: new Date(Date.UTC(year, month - 1, 1)),
    endExclusive: new Date(Date.UTC(year, month, 1)),
  };
}
