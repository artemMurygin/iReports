import type { ShopGoodsTurnoverReportLine } from 'ireports-contracts'

// Адаптация `../goodsTurnoverBodyState.ts` (направление `service`) — тот же резолвер состояния
// (ошибка / период ещё ни разу не пересчитан / готовый отчёт), только `lines` здесь — сам ответ
// эндпоинта (`ShopGoodsTurnoverReportResponse` — плоский массив), а не `report.lines` вложенное
// поле: у `service` ответ — объект `{ period, lines }`, у `shop` — массив строк напрямую (см.
// `contracts/commands/shop-goods-turnover-report.ts`).
export type ShopGoodsTurnoverBodyState = 'error' | 'not-recalculated' | 'ready'

export type ResolveShopGoodsTurnoverBodyStateInput = {
    error: string | null
    lines: ShopGoodsTurnoverReportLine[] | undefined
}

export function resolveShopGoodsTurnoverBodyState(input: ResolveShopGoodsTurnoverBodyStateInput): ShopGoodsTurnoverBodyState {
    if (input.error !== null) return 'error'
    if ((input.lines?.length ?? 0) === 0) return 'not-recalculated'
    return 'ready'
}
