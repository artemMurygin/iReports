import { SegmentedControl, type SegmentedControlOption } from '@/shared/ui-kit/atoms/SegmentedControl'

import type { SchemaDirection } from '../../../model/types.ts'

export type DirectionFieldProps = {
    direction: SchemaDirection
    onDirectionChange: (direction: SchemaDirection) => void
}

// Фаза 4 включает "Магазин" (макет `ZMEof`) — оба направления теперь реально сохраняют схему,
// каждое своим отдельным эндпоинтом/контрактом (см. `service/model/useServiceDirection.ts` и
// `shop/model/useShopDirection.ts`). Цель начисления (Отдел/Сотрудник, соседние поля) не зависит от
// направления: `GET /v1/directory/departments|employees` отдаёт общий Bitrix-справочник, а
// `motivation_schemas` ищется/создаётся по `(targetType, targetId)` без учёта направления —
// направление живёт только на уровне отдельных `salary_rules` (см. ENDPOINTS.md,
// `POST /v1/service|shop/accounting/motivation-schema`).
const DIRECTION_OPTIONS: SegmentedControlOption<SchemaDirection>[] = [
    { value: 'service', label: 'Сервис' },
    { value: 'shop', label: 'Магазин' },
]

export function DirectionField({ direction, onDirectionChange }: DirectionFieldProps) {
    return (
        <div className="flex flex-col gap-[7px]">
            <span className="font-ui text-xs font-medium text-ink-muted">Направление</span>
            <SegmentedControl
                aria-label="Направление"
                options={DIRECTION_OPTIONS}
                value={direction}
                onValueChange={onDirectionChange}
            />
        </div>
    )
}
