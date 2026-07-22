import { CreateSalaryAdjustmentDto } from './salary-adjustment.dto';

describe('CreateSalaryAdjustmentDto', () => {
  const base = {
    employeeId: 1,
    period: '2026-06',
    reason: 'Опоздание',
    createdById: 2,
  };

  it('пропускает PENALTY с отрицательной суммой', () => {
    const result = CreateSalaryAdjustmentDto.schema.safeParse({
      ...base,
      accrualType: 'PENALTY',
      amount: -500,
    });
    expect(result.success).toBe(true);
  });

  it('отклоняет PENALTY с положительной суммой (штраф должен уменьшать ЗП)', () => {
    const result = CreateSalaryAdjustmentDto.schema.safeParse({
      ...base,
      accrualType: 'PENALTY',
      amount: 500,
    });
    expect(result.success).toBe(false);
  });

  it('пропускает ADJUSTMENT с положительной суммой', () => {
    const result = CreateSalaryAdjustmentDto.schema.safeParse({
      ...base,
      accrualType: 'ADJUSTMENT',
      amount: 500,
    });
    expect(result.success).toBe(true);
  });
});
