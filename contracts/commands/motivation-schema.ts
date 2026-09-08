import { z } from 'zod';
import { salaryRuleRequestSchema, salaryRuleResponseSchema } from './salary-rule';


const MotivationRequestSchema = z.object({
    targetType: z.enum(['Department', 'Employee']),
    targetId: z.number(),
    name: z.string(),
    rules: z.array(salaryRuleRequestSchema),
});

export type MotivationRequest = z.infer<typeof MotivationRequestSchema>;
export type MotivationResponse = {
    id: string
}

// ========================== Цель схемы (для списка/детали) ========================== //

// Имя цели (отдела/сотрудника) резолвится на бэкенде через справочник
// Bitrix (см. modules/directory) — фронту не нужно делать отдельный запрос,
// чтобы отрисовать карточку схемы в списке/детали (см. страницы
// SalaryRuleList/SalaryRuleDetail).
const motivationSchemaTargetSchema = z.object({
    type: z.enum(['Department', 'Employee']),
    id: z.number(),
    name: z.string(),
});

export type MotivationSchemaTarget = z.infer<
    typeof motivationSchemaTargetSchema
>;

// ========================== Список схем направления service ========================== //

// GET /v1/service/motivation-schema — направление НЕ поле схемы в БД, а
// следствие того, что у схемы есть ≥1 правило direction='service' (см.
// apiDesign плана "Редактирование зарплатных схем"); поэтому у ответа
// direction — литерал, а не производное поле записи.
const motivationSchemaListItemSchema = z.object({
    id: z.string(),
    name: z.string(),
    direction: z.literal('service'),
    target: motivationSchemaTargetSchema,
    ruleCount: z.number(),
    // Уникальные типы правил схемы, в порядке первого появления — для
    // краткого превью состава схемы в карточке списка, без похода за
    // деталями.
    ruleTypes: z.array(z.string()),
    updatedAt: z.string(),
});

export type MotivationSchemaListItem = z.infer<
    typeof motivationSchemaListItemSchema
>;

const listMotivationSchemasQuerySchema = z.object({
    targetType: z.enum(['Department', 'Employee']).optional(),
    targetId: z.coerce.number().optional(),
    search: z.string().optional(),
});

export type ListMotivationSchemasQuery = z.infer<
    typeof listMotivationSchemasQuerySchema
>;

const listMotivationSchemasResponseSchema = z.array(
    motivationSchemaListItemSchema,
);

export type ListMotivationSchemasResponse = z.infer<
    typeof listMotivationSchemasResponseSchema
>;

// ========================== Деталь схемы направления service ========================== //

// GET /v1/service/motivation-schema/:id — полная схема со всеми правилами
// (id+type+name+targetRole+config каждого), готова для предзаполнения формы
// редактирования (см. draftFrom* на фронте).
const motivationSchemaDetailResponseSchema = z.object({
    id: z.string(),
    name: z.string(),
    direction: z.literal('service'),
    target: motivationSchemaTargetSchema,
    rules: z.array(salaryRuleResponseSchema),
    updatedAt: z.string(),
});

export type MotivationSchemaDetailResponse = z.infer<
    typeof motivationSchemaDetailResponseSchema
>;

// ========================== Обновление схемы ========================== //

// PATCH /v1/service/motivation-schema/:id — переименование схемы + полная
// замена набора её правил направления service (см. apiDesign плана:
// "rename + replace all rules of THIS direction"). targetType/targetId
// сознательно отсутствуют — цель схемы редактированием не меняется.
const updateMotivationSchemaRequestSchema = z.object({
    name: z.string(),
    rules: z.array(salaryRuleRequestSchema),
});

export type UpdateMotivationSchemaRequest = z.infer<
    typeof updateMotivationSchemaRequestSchema
>;

export {
    MotivationRequestSchema,
    motivationSchemaTargetSchema,
    motivationSchemaListItemSchema,
    listMotivationSchemasQuerySchema,
    listMotivationSchemasResponseSchema,
    motivationSchemaDetailResponseSchema,
    updateMotivationSchemaRequestSchema,
};
