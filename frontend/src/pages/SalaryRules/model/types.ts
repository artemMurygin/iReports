/**
 * Направление схемы (`Блок · Направление` / `Direction Tabs` в макете `tSYIw`). Только "Сервис"
 * реально создаёт схему в этой фазе (Фаза 4 плана добавляет "Магазин" и его собственный,
 * несмешиваемый контракт — см. `ShopMotivationRequestSchema`); "Магазин" в переключателе показан,
 * но выключен (`disabled`, см. `SalaryRulesTargetCard.tsx`).
 */
export type SchemaDirection = 'service' | 'shop'
