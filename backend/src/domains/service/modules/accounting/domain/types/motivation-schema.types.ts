import { z } from 'zod';
import { MotivationRequestSchema } from 'ireports-contracts';
import { SalaryRule } from '@/domains/service/modules/accounting/domain/types/salary-rule.types';
import { MotivationTarget } from '@/domains/service/modules/accounting/domain/value-objects/motivation-target.value-object';

export type CreateMotivationSchemaProps = z.infer<
    typeof MotivationRequestSchema
>;

// Вход MotivationSchema.create() — targetType/targetId ещё голые примитивы
// (форма command/DTO), внутри сущности собираются в MotivationTarget.
export type MotivationSchemaCreateProps = {
    targetType: string;
    targetId: number;
    name: string;
    rules: SalaryRule[];
};

export type MotivationSchemaProps = {
    target: MotivationTarget;
    name: string;
    rules: SalaryRule[];
};
