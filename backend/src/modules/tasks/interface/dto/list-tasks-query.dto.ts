import { createZodDto } from 'nestjs-zod';
import { listTasksQuerySchema } from 'ireports-contracts';

export class ListTasksQueryDto extends createZodDto(listTasksQuerySchema) {}
