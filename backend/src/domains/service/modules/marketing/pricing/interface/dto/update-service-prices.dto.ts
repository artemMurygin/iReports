import { createZodDto } from 'nestjs-zod';
import { updateServicePricesRequestSchema } from 'ireports-contracts';

export class UpdateServicePricesDto extends createZodDto(
    updateServicePricesRequestSchema,
) {}
