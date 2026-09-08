// Публичное API направления "Сервис": наружу выходит только хук-адаптер — конфиг формы, черновик
// правил, запросы и мутация со своими тостами уже упакованы в него (см. `model/types.ts`,
// `DirectionAdapter`). Контракт `MotivationRequest` за эту границу не выходит.
export { useServiceDirection } from './model/useServiceDirection.ts'
