import { createZodDto } from 'nestjs-zod';
import { putServiceErpCashConfigRequestSchema } from 'ireports-contracts';

export class ErpCashConfigPutDto extends createZodDto(
    putServiceErpCashConfigRequestSchema,
) {}
