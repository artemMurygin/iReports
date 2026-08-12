import { createZodDto } from 'nestjs-zod';
import { startPriceImportRequestSchema } from 'ireports-contracts';

// Тонкая nestjs-zod обёртка над контрактом запроса (Фаза 9, см.
// docs/todo-modules-ddd-refactoring/plan-todo-modules-ddd-refactoring.md) —
// используется будущим HTTP-контроллером `POST
// /v1/shop/marketing/pricing/import-costs` (Фаза 10); сама эта фаза
// контроллер не строит, DTO заведён заранее вместе с контрактом.
export class StartPriceImportDto extends createZodDto(
    startPriceImportRequestSchema,
) {}
