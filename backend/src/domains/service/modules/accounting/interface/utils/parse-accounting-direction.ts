import { ArgumentInvalidException } from '@/shared/exceptions';
import type { AccountingDirection } from '@/shared/domain/calculation-context';

// Общая проверка :direction в URL контроллеров периода (close/reopen/
// recalculate/get) — не через ZodValidationPipe над телом (у этих
// эндпоинтов направление в пути, не в body).
export function parseAccountingDirection(value: string): AccountingDirection {
    if (value !== 'service' && value !== 'shop') {
        throw new ArgumentInvalidException(
            `Недопустимое направление: "${value}", ожидается "service" или "shop"`,
        );
    }
    return value;
}
