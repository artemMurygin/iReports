import { createZodDto } from 'nestjs-zod';
import { upsertWorkScheduleEntryRequestSchema } from 'ireports-contracts';

export class UpsertWorkScheduleEntryDto extends createZodDto(
    upsertWorkScheduleEntryRequestSchema,
) {}
