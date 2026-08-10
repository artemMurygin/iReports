import { z } from 'zod';

export const UpdateServicesResponseSchema = z.object({
    success: z.boolean(),
    count: z.object({
        total: z.number(),
        valid: z.number(),
        create: z.number(),
        update: z.number(),
        errors: z.number(),
    }),
});

export type UpdateServicesResponse = z.infer<
    typeof UpdateServicesResponseSchema
>;
