import { createZodDto } from 'nestjs-zod';
import { listDealsQuerySchema } from 'ireports-contracts';

export class ListDealsQueryDto extends createZodDto(listDealsQuerySchema) {}
