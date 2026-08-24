import { createZodDto } from 'nestjs-zod';
import { putShopErpCashConfigRequestSchema } from 'ireports-contracts';

export class ShopErpCashConfigPutDto extends createZodDto(
    putShopErpCashConfigRequestSchema,
) {}
