// Публичное API направления "Магазин": наружу выходит только хук-адаптер — зеркало
// `service/index.ts` (см. `model/types.ts`, `DirectionAdapter`). Контракт `ShopMotivationRequest`
// за эту границу не выходит.
export { useShopDirection } from './model/useShopDirection.ts'
