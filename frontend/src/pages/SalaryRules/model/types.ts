import type { CatalogCategoryResponse, MotivationRequest, TargetRole } from 'ireports-contracts'

import type { RuleFormConfig, RuleListState, RuleType } from '@/features/SalaryRuleForm'

/**
 * Направление схемы (`Блок · Направление` / `Direction Tabs` в макете `tSYIw`). Только "Сервис"
 * реально создаёт схему в этой фазе (Фаза 4 плана добавляет "Магазин" и его собственный,
 * несмешиваемый контракт — см. `ShopMotivationRequestSchema`); "Магазин" в переключателе показан,
 * но выключен (`disabled`, см. `ui/TargetCard`).
 */
export type SchemaDirection = 'service' | 'shop'

/** Цель начисления — общий для обоих направлений Bitrix-справочник (`Отдел`/`Сотрудник`), см.
 * `features/TargetDirectory`. Форма значения совпадает у обоих контрактов схемы
 * (`MotivationRequest`/`ShopMotivationRequest`), поэтому берётся из сервисного как из первого. */
export type TargetType = MotivationRequest['targetType']

/** Всё, что Шаг 1 знает о будущей схеме, — единственный аргумент `DirectionAdapter.submit`:
 * направление само достраивает до payload своего контракта. */
export type SchemaTarget = {
    targetType: TargetType
    targetId: number
    name: string
}

/**
 * Единая форма, которой оба направления (`service/model/useServiceDirection.ts`,
 * `shop/model/useShopDirection.ts`) отдают странице всё, что ей от них нужно. Контракт правил
 * (`SalaryRuleRequest` vs `ShopSalaryRuleRequest`) прячется внутри адаптера: наружу выходит только
 * направление-агностичный `RuleListState` (без `resolvedRules`) и `submit`, который сам собирает
 * payload своего эндпоинта и сам показывает тосты. Благодаря этому единственное сравнение
 * направлений во всём модуле — выбор активного адаптера в `useSalaryRulesPage.ts`, а `core/`
 * вообще не знает о существовании направлений.
 *
 * Контракты `MotivationRequest` и `ShopMotivationRequest` при этом никогда не смешиваются в один
 * тип — каждый живёт только внутри своего поддерева (см. `contracts/commands/shop-salary-rule.ts`,
 * "issue #57: направления технически не связаны одним объектом").
 */
export type DirectionAdapter = {
    config: RuleFormConfig
    rules: RuleListState
    allowedRolesByType: Partial<Record<RuleType, TargetRole[]>>
    isRoleTypesLoading: boolean
    roleTypesError: string | null
    categories: CatalogCategoryResponse[]
    isCategoriesLoading: boolean
    categoriesError: string | null
    isSubmitting: boolean
    /** `id` из ответа своей мутации (`MotivationResponse`/`ShopMotivationResponse` — строка, см.
     * `contracts/commands/motivation-schema.ts`), `null` пока схема этого направления не сохранена. */
    savedSchemaId: string | null
    submit: (target: SchemaTarget) => void
}
