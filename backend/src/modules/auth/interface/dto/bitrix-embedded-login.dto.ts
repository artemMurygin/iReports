import { createZodDto } from 'nestjs-zod';
import { bitrixEmbeddedLoginRequestSchema } from 'ireports-contracts';

export class BitrixEmbeddedLoginDto extends createZodDto(
    bitrixEmbeddedLoginRequestSchema,
) {}
