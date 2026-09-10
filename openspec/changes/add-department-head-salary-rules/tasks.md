## 1. Contracts — новые виды правил и роль (service + shop)

- [x] 1.1 Написать zod-тесты на `salary-rule.ts`/`shop-salary-rule.ts`: 3 новых discriminated-union члена (`DepartmentPercent`, `DepartmentPlanBonus`, `DepartmentTurnoverBonus`) и новый литерал роли «Руководитель направления» в `targetRoleSchema` — валидные и невалидные payload'ы
- [x] 1.2 Прогнать тесты из 1.1 и зафиксировать red (типов ещё нет)
- [x] 1.3 Реализовать схемы в `contracts/commands/salary-rule.ts` и `contracts/commands/shop-salary-rule.ts`
- [x] 1.4 Прогнать тесты из 1.1 и зафиксировать green, регрессий у существующих 4 видов правил нет

## 2. Contracts — ответ отчёта «Оборачиваемость» (FR5, BREAKING для shop)

- [x] 2.1 Написать тесты на схему ответа: `goods-turnover-report.ts` (service) — аддитивное поле `totals` в `{period, lines}`; `shop-goods-turnover-report.ts` — смена формы на `{lines, totals}`
- [x] 2.2 Прогнать тесты из 2.1 и зафиксировать red
- [x] 2.3 Реализовать обе схемы
- [x] 2.4 Прогнать тесты из 2.1 и зафиксировать green

## 3. Backend/service: формула итога по складу (warehouse)

- [x] 3.1 Написать тесты на `TurnoverRatioValueObject` (инвариант `value > 0`) и на `GoodsTurnoverWarehouseTotal` (warehouse/service) — формула «сумма по настоящим корневым строкам + средневзвешенный коэффициент» (design.md, Decision 6a)
- [x] 3.2 Прогнать тесты из 3.1 и зафиксировать red
- [x] 3.3 Реализовать `TurnoverRatioValueObject` и `GoodsTurnoverWarehouseTotal` в `domains/service/modules/warehouse`
- [x] 3.4 Прогнать тесты из 3.1 и зафиксировать green

## 4. Backend/service: `GoodsTurnoverReport.totals()` + `GetGoodsTurnoverReportService`

- [x] 4.1 Написать тесты: агрегат `GoodsTurnoverReport.totals()` возвращает `GoodsTurnoverWarehouseTotal[]` по складам; `GetGoodsTurnoverReportService` восстанавливает агрегат через репозиторий (не только строки) и возвращает `{period, lines, totals}`
- [x] 4.2 Прогнать тесты из 4.1 и зафиксировать red
- [x] 4.3 Реализовать метод `totals()` на агрегате `GoodsTurnoverReport` и модифицировать `GetGoodsTurnoverReportService`
- [x] 4.4 Прогнать тесты из 4.1 и зафиксировать green, убедиться что существующее поле `lines` не изменило форму

## 5. Backend/shop: `GoodsTurnoverWarehouseTotal` + `GetGoodsTurnoverReportService` (BREAKING)

- [x] 5.1 Написать тесты: `GoodsTurnoverWarehouseTotal.calculate(lines)` (warehouse/shop, независимая реализация той же формулы, вызывается статически по образцу `TurnoverCoefficient`) и `GetGoodsTurnoverReportService` (shop) возвращает `{lines, totals}` вместо голого массива
- [x] 5.2 Прогнать тесты из 5.1 и зафиксировать red
- [x] 5.3 Реализовать `GoodsTurnoverWarehouseTotal` (warehouse/shop) и модифицировать `GetGoodsTurnoverReportService` (shop)
- [x] 5.4 Прогнать тесты из 5.1 и зафиксировать green

## 6. Backend/service: `TurnoverReportSnapshot` + `TURNOVER_REPORT_REPOSITORY` (accounting)

- [x] 6.1 Написать тесты: `TurnoverReportSnapshot` восстанавливается из `goods_turnover_report_lines` через собственный Prisma-делегат модуля `accounting` (без обращения к сервисам модуля `warehouse` — root `CLAUDE.md`, изоляция между модулями); `TURNOVER_REPORT_REPOSITORY.findByPeriodAndWarehouse`
- [x] 6.2 Прогнать тесты из 6.1 и зафиксировать red
- [x] 6.3 Реализовать `TurnoverReportSnapshot`, порт `TURNOVER_REPORT_REPOSITORY`, Prisma-репозиторий и собственную копию `GoodsTurnoverWarehouseTotal` внутри `accounting/service` (Decision 6b), зарегистрировать провайдеры в модуле
- [x] 6.4 Прогнать тесты из 6.1 и зафиксировать green

## 7. Backend/shop: `TurnoverReportSnapshot` + `SHOP_TURNOVER_REPORT_REPOSITORY` (accounting)

- [x] 7.1 Написать тесты: `TurnoverReportSnapshot` (shop) восстанавливается из `moy_sklad_turnover_report_lines` через собственный Prisma-делегат `accounting/shop`; `SHOP_TURNOVER_REPORT_REPOSITORY.findByPeriodAndWarehouse`
- [x] 7.2 Прогнать тесты из 7.1 и зафиксировать red
- [x] 7.3 Реализовать зеркально п.6 для shop, зарегистрировать провайдеры
- [x] 7.4 Прогнать тесты из 7.1 и зафиксировать green

## 8. Backend/service: `TURNOVER_PERFORMANCE_READER` + `resolveTurnoverPercentCompletion`

- [ ] 8.1 Написать тесты: `TurnoverPerformanceReaderPort.findForScope(period, warehouseId, category)` — факт по категории склада и итог по всему складу при `category = null` (из `TurnoverReportSnapshot`), `null` при недостатке данных; `resolveTurnoverPercentCompletion(factRatio, planRatio)` — включая `factRatio = null`
- [ ] 8.2 Прогнать тесты из 8.1 и зафиксировать red
- [ ] 8.3 Реализовать `GetTurnoverPerformanceService` (реализация порта через `TURNOVER_REPORT_REPOSITORY`) и `resolveTurnoverPercentCompletion` (service)
- [ ] 8.4 Прогнать тесты из 8.1 и зафиксировать green

## 9. Backend/shop: `SHOP_TURNOVER_PERFORMANCE_READER` + `resolveTurnoverPercentCompletion`

- [ ] 9.1 Написать тесты зеркально п.8 для shop
- [ ] 9.2 Прогнать тесты из 9.1 и зафиксировать red
- [ ] 9.3 Реализовать `GetShopTurnoverPerformanceService` и `resolveTurnoverPercentCompletion` (shop)
- [ ] 9.4 Прогнать тесты из 9.1 и зафиксировать green

## 10. Backend/service: 3 новых entity правила + роль

- [ ] 10.1 Написать тесты на `.calculate()` трёх сущностей: `DepartmentPercentEntity` (`round(fact.(turnover|margin) * percent / 100)` по `category`), `DepartmentPlanBonusEntity` (`round(fixedAmount * multiplier(percentCompletion))`), `DepartmentTurnoverBonusEntity` (`round(fixedAmount * multiplier(resolveTurnoverPercentCompletion(...)))`)
- [ ] 10.2 Прогнать тесты из 10.1 и зафиксировать red
- [ ] 10.3 Реализовать 3 entity в `domains/service/modules/accounting/domain/entities/salary-rules/` и добавить новую роль в `ALL_SERVICE_ROLES` (`salary-rule-role-catalog.ts`) — без матчинга по заказу (`role-source.ts` для этой роли не используется, правило матчится напрямую на сотрудника со схемой)
- [ ] 10.4 Прогнать тесты из 10.1 и зафиксировать green

## 11. Backend/shop: 3 зеркальных entity правила + роль

- [ ] 11.1 Написать тесты зеркально п.10 для `DepartmentPercentEntity`/`DepartmentPlanBonusEntity`/`DepartmentTurnoverBonusEntity` (shop), `config.warehouseId` — склад МойСклад
- [ ] 11.2 Прогнать тесты из 11.1 и зафиксировать red
- [ ] 11.3 Реализовать 3 entity в `domains/shop/modules/accounting/domain/entities/salary-rules/` и добавить роль в `ALL_SHOP_ROLES`
- [ ] 11.4 Прогнать тесты из 11.1 и зафиксировать green

## 12. Backend/service: расчётный контекст + registry/factory/mapper

- [ ] 12.1 Написать тесты: `BuildServiceCalculationContextService` строит `context.turnoverPerformance`; `context.salesPerformance` меняет тип значения с `number` на `{ fact, percentCompletion }` (Decision 3); `serviceSalaryRuleRegistry`/`ServiceSalaryRuleFactory` диспатчат 3 новых `type`; `SalaryRuleMapper` (де)сериализует их `props`
- [ ] 12.2 Прогнать тесты из 12.1 и зафиксировать red
- [ ] 12.3 Реализовать изменения контекста, registry/factory, mapper — обновить ВСЕХ существующих потребителей `context.salesPerformance` (4 существующих вида правил service), заменив прямое использование числа на `.fact`, чтобы не сломать текущий расчёт
- [ ] 12.4 Прогнать тесты из 12.1 и полный набор существующих salary-rule тестов service, зафиксировать green без регрессий

## 13. Backend/shop: расчётный контекст + registry/factory/mapper

- [ ] 13.1 Написать тесты зеркально п.12 для shop (`BuildShopCalculationContextService`, `shopSalaryRuleRegistry`/`ShopSalaryRuleFactory`, `ShopSalaryRuleMapper`)
- [ ] 13.2 Прогнать тесты из 13.1 и зафиксировать red
- [ ] 13.3 Реализовать изменения, обновить существующих потребителей `context.salesPerformance` (4 существующих вида правил shop)
- [ ] 13.4 Прогнать тесты из 13.1 и полный набор существующих salary-rule тестов shop, зафиксировать green без регрессий

## 14. Frontend: схема формы, конфиг наград, лейбл роли (service + shop)

- [ ] 14.1 Написать тесты: `ruleFormSchema` (service+shop) принимает 3 новых award-типа; `ruleAwards.ts` содержит конфиг полей для них; `roleLabels.ts` содержит лейбл «Руководитель направления»
- [ ] 14.2 Прогнать тесты из 14.1 и зафиксировать red
- [ ] 14.3 Реализовать в `features/SalaryRuleForm/{service,shop}/model` (`ruleFormSchema.ts`, `ruleAwards.ts`, `roleLabels.ts`)
- [ ] 14.4 Прогнать тесты из 14.1 и зафиксировать green

## 15. Frontend: `WarehouseField` (новый компонент)

- [ ] 15.1 Написать тесты: компонент рендерит список складов, вызывает `onChange` при выборе, обязателен для `DepartmentTurnoverBonus`
- [ ] 15.2 Прогнать тесты из 15.1 и зафиксировать red
- [ ] 15.3 Реализовать `features/SalaryRuleForm/ui/WarehouseField` — визуально переиспользовать `ERP/Molecule/Field` по паттерну поля «Склад» в карточке FR4 (Node ID `WdQo0`/`Cp19t`, `design/sallary-first-iteration.pen` — читать точную структуру через `mcp__pencil__execute`/`Get`, тот же паттерн, что уже применён у `CategoryField`)
- [ ] 15.4 Прогнать тесты из 15.1 и зафиксировать green

## 16. Frontend: `RuleFormCardFields` — 3 новые ветки рендера полей (desktop + mobile)

- [ ] 16.1 Написать тесты: при award-типе `DepartmentPercent`/`DepartmentPlanBonus`/`DepartmentTurnoverBonus` рендерится корректный набор полей (Категория + База начисления + Процент / Категория + База начисления + Сумма + пороги / Склад + Категория + Сумма + План коэфф. + пороги) и НЕ рендерится блок «Вариант награды» (подтверждено — у этих 3 видов фиксированный набор полей на тип, без award-выбора)
- [ ] 16.2 Прогнать тесты из 16.1 и зафиксировать red
- [ ] 16.3 Реализовать 3 ветки в `features/SalaryRuleForm/ui/RuleFormCard/ui/RuleFormCardFields` по карточкам из `ui-design.md` (читать точную структуру полей через `mcp__pencil__execute`/`Get` по Node ID в `design/sallary-first-iteration.pen`): desktop — `x8OVx` (FR2), `O9tPQ` (FR3), `WdQo0` (FR4); мобильный 390 — `ThvHu` (FR2), `sHiW6` (FR3), `PXeac` (FR4)
- [ ] 16.4 Прогнать тесты из 16.1 и зафиксировать green, сверить каждое состояние со скриншотом соответствующей карточки в Pencil

## 17. Frontend: лейблы новых типов в `SalaryAccruals`/`SalaryReportData`

- [ ] 17.1 Написать тесты: `model/labels.ts` обеих фич возвращает корректный текст для 3 новых типов правил
- [ ] 17.2 Прогнать тесты из 17.1 и зафиксировать red
- [ ] 17.3 Реализовать в `features/SalaryAccruals/model/labels.ts` и `features/SalaryReportData/model/labels.ts`
- [ ] 17.4 Прогнать тесты из 17.1 и зафиксировать green

## 18. Frontend: `GoodsTurnoverReport` — переход на `totals` из API

- [ ] 18.1 Написать тесты: страница рендерит строку «Итого» из поля `totals` ответа API (а не через `summarizeGoodsTurnoverRows`/`summarizeShopGoodsTurnoverRows`); shop-версия корректно читает новую форму ответа `{lines, totals}`
- [ ] 18.2 Прогнать тесты из 18.1 и зафиксировать red
- [ ] 18.3 Удалить `model/{,shop/}goodsTurnoverTree.ts` (`summarizeGoodsTurnoverRows`/`summarizeShopGoodsTurnoverRows`) и подключить рендер «Итого» из `totals` ответа API (service + shop)
- [ ] 18.4 Прогнать тесты из 18.1 и зафиксировать green

## 19. Интеграционная проверка

- [ ] 19.1 Прогнать backend test suite для `domains/service/modules/accounting`, `domains/shop/modules/accounting`, `domains/{service,shop}/modules/warehouse` (`npm run test -- accounting` / `-- warehouse`) — без регрессий
- [ ] 19.2 Прогнать frontend test suite для `features/SalaryRuleForm`, `features/SalaryAccruals`, `features/SalaryReportData`, `pages/GoodsTurnoverReport` — без регрессий
- [ ] 19.3 Обновить `ENDPOINTS.md`, если описание ответа эндпоинта `GET .../goods-turnover-report/:period` (shop) требует пометки об изменении формы ответа
