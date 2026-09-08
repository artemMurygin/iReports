import { z } from 'zod';

/**
 * МойСклад передаёт все суммовые показатели в копейках.
 * Схема переводит их в рубли ещё на этапе валидации ответа API.
 */
export const MoneySchema = z.number().transform((kopecks) => kopecks / 100);
