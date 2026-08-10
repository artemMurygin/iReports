import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

const updateShopProductsCostsSchema = z.object({
    file: z
        .string()
        .min(1, 'File is required')
        .refine(
            (val) => /^[A-Za-z0-9+/]*={0,2}$/.test(val),
            'File must be a valid base64 string',
        ),
});

export class UpdateShopProductsCostsDTO extends createZodDto(
    updateShopProductsCostsSchema,
) {}
