import { createZodDto } from 'nestjs-zod';
import { updateTaskRequestSchema } from 'ireports-contracts';

export class UpdateTaskDto extends createZodDto(updateTaskRequestSchema) {}
