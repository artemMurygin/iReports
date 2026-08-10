import { z } from 'zod';
import { MotivationRequestSchema } from 'ireports-contracts';
import { SalaryRule } from '@/domains/service/modules/accounting/domain/types/salary-rule.types';

export type CreateMotivationSchemaProps = z.infer<
    typeof MotivationRequestSchema
>;

export type MotivationSchemaCreateProps = {
    targetType: string;
    targetId: number;
    name: string;
    rules: SalaryRule[];
};
