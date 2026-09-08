import { z } from 'zod';
import { ApiBody } from '@nestjs/swagger';

// SchemaObject не входит в публичный API @nestjs/swagger (не реэкспортится
// из индекса пакета, а глубокий импорт из dist/interfaces/* запрещён его
// "exports" в package.json под moduleResolution: nodenext) — выводим тот же
// тип структурно через уже публичный ApiBody, а не копируем интерфейс
// руками.
type OpenApiBodySchema = Extract<
    Parameters<typeof ApiBody>[0],
    { schema: unknown }
>['schema'];

// Для тел запроса, объявленных через createZodDto, Swagger достаёт схему
// сам (см. main.ts — SwaggerModule.createDocument + cleanupOpenApiDoc).
// Union-тела (например, "один план или массив планов" у
// createSalesPlanRequestSchema, или "ids | direction+period" у
// approveSalesPlanRequestSchema) с createZodDto несовместимы (TS2509,
// инстанс DTO — не объектный тип), поэтому валидируются на контроллере
// напрямую через ZodValidationPipe, без DTO-класса — Nest в этом случае не
// может ничего вывести через рефлексию типов и Swagger UI показывает тело
// как голый "string". Эта функция — ручной обходной путь: конвертирует
// zod-схему в OpenAPI SchemaObject для явной передачи в @ApiBody({ schema }).
// $schema — служебный ключ JSON Schema, а не OpenAPI, поэтому вырезается.
export function zodSchemaToOpenApiBody(schema: z.ZodType): OpenApiBodySchema {
    const jsonSchema = z.toJSONSchema(schema) as Record<string, unknown>;
    delete jsonSchema.$schema;
    return jsonSchema;
}
