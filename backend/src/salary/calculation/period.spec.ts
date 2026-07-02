import { parsePeriod } from './period';

describe('parsePeriod', () => {
  it('возвращает первое число месяца и первое число следующего (полугодовая граница)', () => {
    const { start, endExclusive } = parsePeriod('2026-06');
    expect(start.toISOString()).toBe('2026-06-01T00:00:00.000Z');
    expect(endExclusive.toISOString()).toBe('2026-07-01T00:00:00.000Z');
  });

  it('корректно переходит через границу года (декабрь -> январь)', () => {
    const { start, endExclusive } = parsePeriod('2026-12');
    expect(start.toISOString()).toBe('2026-12-01T00:00:00.000Z');
    expect(endExclusive.toISOString()).toBe('2027-01-01T00:00:00.000Z');
  });
});
