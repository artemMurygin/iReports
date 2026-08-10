import { z } from 'zod';
import { salaryRuleRequestSchema } from './salary-rule';


const MotivationRequestSchema = z.object({
    targetType: z.enum(['Department', 'Employee']),
    targetId: z.number(),
    name: z.string(),
    rules: z.array(salaryRuleRequestSchema),
});

export type MotivationRequest = z.infer<typeof MotivationRequestSchema>;
export type MotivationResponse = {
    id: string
}

export { MotivationRequestSchema };
