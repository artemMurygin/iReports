import { createZodDto } from 'nestjs-zod';
import { setTaskRuleActualAmountRequestSchema } from 'ireports-contracts';

export class SetTaskRuleActualAmountDto extends createZodDto(
    setTaskRuleActualAmountRequestSchema,
) {}
