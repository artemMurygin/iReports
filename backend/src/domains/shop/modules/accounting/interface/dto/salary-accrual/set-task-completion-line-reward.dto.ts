import { createZodDto } from 'nestjs-zod';
import { setTaskCompletionLineRewardRequestSchema } from 'ireports-contracts';

export class SetShopTaskCompletionLineRewardDto extends createZodDto(
    setTaskCompletionLineRewardRequestSchema,
) {}
