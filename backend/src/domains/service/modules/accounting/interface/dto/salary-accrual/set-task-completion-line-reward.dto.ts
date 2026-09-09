import { createZodDto } from 'nestjs-zod';
import { setTaskCompletionLineRewardRequestSchema } from 'ireports-contracts';

export class SetTaskCompletionLineRewardDto extends createZodDto(
    setTaskCompletionLineRewardRequestSchema,
) {}
