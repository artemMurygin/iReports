import { createZodDto } from 'nestjs-zod';
import { createTaskRequestSchema } from 'ireports-contracts';

export class CreateTaskDto extends createZodDto(createTaskRequestSchema) {}
