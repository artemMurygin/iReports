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

- [x] 8.1 Написать тесты: `TurnoverPerformanceReaderPort.findForScope(period, warehouseId, category)` — факт по категории склада и итог по всему складу при `category = null` (из `TurnoverReportSnapshot`), `null` при недостатке данных; `resolveTurnoverPercentCompletion(factRatio, planRatio)` — включая `factRatio = null`
- [x] 8.2 Прогнать тесты из 8.1 и зафиксировать red
- [x] 8.3 Реализовать `GetTurnoverPerformanceService` (реализация порта через `TURNOVER_REPORT_REPOSITORY`) и `resolveTurnoverPercentCompletion` (service)
- [x] 8.4 Прогнать тесты из 8.1 и зафиксировать green

## 9. Backend/shop: `SHOP_TURNOVER_PERFORMANCE_READER` + `resolveTurnoverPercentCompletion`

- [x] 9.1 Написать тесты зеркально п.8 для shop
- [x] 9.2 Прогнать тесты из 9.1 и зафиксировать red
- [x] 9.3 Реализовать `GetShopTurnoverPerformanceService` и `resolveTurnoverPercentCompletion` (shop)
- [x] 9.4 Прогнать тесты из 9.1 и зафиксировать green

## 10. Backend/service: 3 новых entity правила + роль

- [x] 10.1 Написать тесты на `.calculate()` трёх сущностей: `DepartmentPercentEntity` (`round(fact.(turnover|margin) * percent / 100)` по `category`), `DepartmentPlanBonusEntity` (`round(fixedAmount * multiplier(percentCompletion))`), `DepartmentTurnoverBonusEntity` (`round(fixedAmount * multiplier(resolveTurnoverPercentCompletion(...)))`)
- [x] 10.2 Прогнать тесты из 10.1 и зафиксировать red
- [x] 10.3 Реализовать 3 entity в `domains/service/modules/accounting/domain/entities/salary-rules/` и добавить новую роль в `ALL_SERVICE_ROLES` (`salary-rule-role-catalog.ts`) — без матчинга по заказу (`role-source.ts` для этой роли не используется, правило матчится напрямую на сотрудника со схемой)
- [x] 10.4 Прогнать тесты из 10.1 и зафиксировать green

## 11. Backend/shop: 3 зеркальных entity правила + роль

- [x] 11.1 Написать тесты зеркально п.10 для `DepartmentPercentEntity`/`DepartmentPlanBonusEntity`/`DepartmentTurnoverBonusEntity` (shop), `config.warehouseId` — склад МойСклад
- [x] 11.2 Прогнать тесты из 11.1 и зафиксировать red
- [x] 11.3 Реализовать 3 entity в `domains/shop/modules/accounting/domain/entities/salary-rules/` и добавить роль в `ALL_SHOP_ROLES`
- [x] 11.4 Прогнать тесты из 11.1 и зафиксировать green

## 12. Backend/service: расчётный контекст + registry/factory/mapper

- [x] 12.1 Написать тесты: `BuildServiceCalculationContextService` строит `context.turnoverPerformance`; `context.salesPerformance` меняет тип значения с `number` на `{ fact, percentCompletion }` (Decision 3); `serviceSalaryRuleRegistry`/`ServiceSalaryRuleFactory` диспатчат 3 новых `type`; `SalaryRuleMapper` (де)сериализует их `props`
- [x] 12.2 Прогнать тесты из 12.1 и зафиксировать red
- [x] 12.3 Реализовать изменения контекста, registry/factory, mapper — обновить ВСЕХ существующих потребителей `context.salesPerformance` (4 существующих вида правил service), заменив прямое использование числа на `.fact`, чтобы не сломать текущий расчёт
- [x] 12.4 Прогнать тесты из 12.1 и полный набор существующих salary-rule тестов service, зафиксировать green без регрессий

  Примечание по реализации (см. финальный отчёт агента): `departmentSalesPerformance`/`turnoverPerformance` реализованы как ДОПОЛНИТЕЛЬНЫЕ поля контекста (уже заложенные группой 10 в `calculation-context.types.ts`), а не как смена формы существующего `context.salesPerformance` — тот у service уже сегодня одиночный `SalesPerformanceContext` (не `Map`) и остаётся без изменений; 4 существующих вида правил service (`context.salesPerformance.percentCompletion` у `OrderPayed`) не затронуты и не требовали правки. Обнаружен и обойдён (см. `toRoappCategoryId` в `build-service-calculation-context.service.ts`) сторонний, ранее существовавший разрыв типов между `DepartmentTurnoverBonusSalaryConfig.category: string | null` (contracts, группа 1) и `TurnoverPerformanceReaderPort.findForScope(..., category: number | null)` (группа 8) — не устранён в контрактах/сущностях (не в скоупе групп 12–13), задокументирован инлайн-комментарием.

## 13. Backend/shop: расчётный контекст + registry/factory/mapper

- [x] 13.1 Написать тесты зеркально п.12 для shop (`BuildShopCalculationContextService`, `shopSalaryRuleRegistry`/`ShopSalaryRuleFactory`, `ShopSalaryRuleMapper`)
- [x] 13.2 Прогнать тесты из 13.1 и зафиксировать red
- [x] 13.3 Реализовать изменения, обновить существующих потребителей `context.salesPerformance` (4 существующих вида правил shop)
- [x] 13.4 Прогнать тесты из 13.1 и полный набор существующих salary-rule тестов shop, зафиксировать green без регрессий

  Примечание по реализации: аналогично п.12 — `context.salesPerformance` (`Map<category, number>`) у shop тоже НЕ менялся, `departmentSalesPerformance`/`turnoverPerformance` — отдельные поля; `ProductSold`/`UsedProductSold` не затронуты. warehouseId/category у shop — оба `string` end-to-end, разрыва типов (как у service) нет.

## 14. Frontend: схема формы, конфиг наград, лейбл роли (service + shop)

- [x] 14.1 Написать тесты: `ruleFormSchema` (service+shop) принимает 3 новых award-типа; `ruleAwards.ts` содержит конфиг полей для них; `roleLabels.ts` содержит лейбл «Руководитель направления»
- [x] 14.2 Прогнать тесты из 14.1 и зафиксировать red
- [x] 14.3 Реализовать в `features/SalaryRuleForm/{service,shop}/model` (`ruleFormSchema.ts`, `ruleAwards.ts`, `roleLabels.ts`)
- [x] 14.4 Прогнать тесты из 14.1 и зафиксировать green

  Примечание по реализации (см. финальный отчёт агента): помимо трёх файлов из 14.3, потребовались
  необходимые сопутствующие правки — `kernel/ruleTypeLabels.ts` (3 новых литерала типа + лейблы для
  обоих направлений — без этого `ruleFormSchema.ts` не компилировался бы против уже расширенного
  контрактами `SalaryRuleResponse`/`ShopSalaryRuleResponse`), `model/ruleDraft.ts` (новые поля
  `warehouseId`/`planTurnoverRatio`, нужные обоим `ruleFormSchema.ts` для FR4) и
  `model/formNumberUtils.ts` (`RuleFieldErrors` — ключи `warehouseId`/`planTurnoverRatio`). Также
  точечно закрыты 2 записи `AWARD_OPTIONS_BY_TYPE`/`SHOP_AWARD_OPTIONS_BY_TYPE` (`service/shop/model/
  ruleTypes.ts`, пустые массивы `[]` по образцу `PayPerHour`/`TaskCompletion` — у FR2–FR4 нет
  «Варианта награды», ui-design.md «Отклонения») — без этого `Record<ServiceRuleType|ShopRuleType,
  ...>` не проходил типизацию после расширения union'а; сам рендеринг новых типов (`RuleFormCardFields`,
  `RULE_TYPE_ORDER`/выбор в UI) остаётся за группой 16/15 и не добавлялся. `ROLE_LABELS`-копии в
  `features/SalaryAccruals`/`features/SalaryReportData` (`Record<TargetRole,...>`) и
  `pages/GoodsTurnoverReport` — уже были не откомпилированы до начала этой группы (последствие
  контрактов из групп 1/2, не этой группы) и намеренно не тронуты — вне скоупа (группы 17/18).

## 15. Frontend: `WarehouseField` (новый компонент)

- [x] 15.1 Написать тесты: компонент рендерит список складов, вызывает `onChange` при выборе, обязателен для `DepartmentTurnoverBonus`
- [x] 15.2 Прогнать тесты из 15.1 и зафиксировать red
- [x] 15.3 Реализовать `features/SalaryRuleForm/ui/WarehouseField` — визуально переиспользовать `ERP/Molecule/Field` по паттерну поля «Склад» в карточке FR4 (Node ID `WdQo0`/`Cp19t`, `design/sallary-first-iteration.pen` — читать точную структуру через `mcp__pencil__execute`/`Get`, тот же паттерн, что уже применён у `CategoryField`)
- [x] 15.4 Прогнать тесты из 15.1 и зафиксировать green

## 16. Frontend: `RuleFormCardFields` — 3 новые ветки рендера полей (desktop + mobile)

- [x] 16.1 Написать тесты: при award-типе `DepartmentPercent`/`DepartmentPlanBonus`/`DepartmentTurnoverBonus` рендерится корректный набор полей (Категория + База начисления + Процент / Категория + База начисления + Сумма + пороги / Склад + Категория + Сумма + План коэфф. + пороги) и НЕ рендерится блок «Вариант награды» (подтверждено — у этих 3 видов фиксированный набор полей на тип, без award-выбора)
- [x] 16.2 Прогнать тесты из 16.1 и зафиксировать red
- [x] 16.3 Реализовать 3 ветки в `features/SalaryRuleForm/ui/RuleFormCard/ui/RuleFormCardFields` по карточкам из `ui-design.md` (читать точную структуру полей через `mcp__pencil__execute`/`Get` по Node ID в `design/sallary-first-iteration.pen`): desktop — `x8OVx` (FR2), `O9tPQ` (FR3), `WdQo0` (FR4); мобильный 390 — `ThvHu` (FR2), `sHiW6` (FR3), `PXeac` (FR4)
- [x] 16.4 Прогнать тесты из 16.1 и зафиксировать green, сверить каждое состояние со скриншотом соответствующей карточки в Pencil

  Примечание по реализации (см. финальный отчёт агента): точная структура/лейблы/порядок полей всех
  6 карточек (`x8OVx`/`O9tPQ`/`WdQo0`/`ThvHu`/`sHiW6`/`PXeac`) прочитаны через `mcp__pencil__execute`/
  `Get` — сверка со «скриншотом» сделана как построчное сравнение прочитанной JSON-структуры узлов
  (лейблы `Label`/`Hint`, порядок `Row Base`/`Row Params`/`Row Warehouse`/`Row Amount`), а не через
  фактический рендер приложения в браузере (dev-сервер в скоупе задачи не поднимался); мобильные
  карточки (390) подтвердили тот же порядок и состав полей в один столбец — отдельной мобильной
  вёрстки не потребовалось, использованы уже mobile-адаптивные `PercentSliderField`/`SalaryBasisField`/
  `ThresholdsEditor`/`CategoryField`/`WarehouseField` (Фаза 5 pattern), см. комментарий над
  `RuleFormCardFields`. Помимо самого компонента, потребовались минимальные сопутствующие правки вне
  файла из заголовка группы, необходимые, чтобы 3 новые ветки были реально достижимы и не дублировали
  «Вариант награды»: `RuleFormCard.tsx` (пропускает `AwardSection`/лишний divider для
  `showDepartmentFields`, прокидывает новые пропсы `onChangeBorder`/`warehouses` в
  `RuleFormCardFields`), `model/useRuleFormCard.ts` (`showDepartmentFields`), `model/ruleDraft.ts`
  (`DEPARTMENT_RULE_TYPES`), `model/types.ts` (опциональные `warehouses`/`isWarehousesLoading`/
  `warehousesError` в `RuleFormCardContext`) и `service/model/ruleTypes.ts`/`shop/model/ruleTypes.ts`
  (3 новых типа добавлены в `RULE_TYPE_ORDER`/`SHOP_RULE_TYPE_ORDER` перед `TaskCompletion` — иначе
  «Тип правила» select никогда бы их не предлагал; группа 14 явно отложила это на группу 16/15, см. её
  примечание). Реальное подключение справочника складов к API (аналог `useOrderTypes`/`useCatalog`) не
  добавлялось — `warehouses` остаётся опциональным пропом, по умолчанию `[]`; в tasks.md нет отдельной
  группы для этого проводника, вероятный пробел плана вне скоупа групп 14-16.

## 17. Frontend: лейблы новых типов в `SalaryAccruals`/`SalaryReportData`

- [x] 17.1 Написать тесты: `model/labels.ts` обеих фич возвращает корректный текст для 3 новых типов правил
- [x] 17.2 Прогнать тесты из 17.1 и зафиксировать red
- [x] 17.3 Реализовать в `features/SalaryAccruals/model/labels.ts` и `features/SalaryReportData/model/labels.ts`
- [x] 17.4 Прогнать тесты из 17.1 и зафиксировать green

  Примечание по реализации: единственный реальный пробел в обоих `labels.ts` — `ROLE_LABEL`/
  `ROLE_LABELS` (`Record<TargetRole, string>`) не хватало ключа `DEPARTMENT_HEAD` (FR1, `TargetRole`
  расширен контрактами группы 1), из-за чего оба файла не проходили `tsc -b` (проверено:
  `npx tsc -b --noEmit` до правки называл именно эти два файла). Для самих 3 новых ТИПОВ правил
  (FR2–FR4) отдельного кода в этих файлах не потребовалось — прецедент уже есть в истории репозитория
  (commit 302dc77, добавление типа `TaskCompletion`): `SalaryReportData/model/labels.ts`'s
  `RULE_TYPE_LABELS`/`getRuleTypeLabel` — прямой реэкспорт `kernel/ruleTypeLabels.ts`'s
  `ALL_RULE_TYPE_LABELS`, уже донёсшего лейблы 3 новых типов (группа 14); `SalaryAccruals`
  отображает тип строки через `formatLineMeta` (`model/accrualView.ts`), которая читает тот же
  `ALL_RULE_TYPE_LABELS` из kernel напрямую, а не через `labels.ts` — так же было устроено и для уже
  существующего `TaskCompletion`. `RULE_UNIT_FORMS`/`RULE_UNIT_PLURAL_LABEL` сознательно не получили
  записей для 3 новых типов: `DepartmentPercentEntity`/`DepartmentPlanBonusEntity`/
  `DepartmentTurnoverBonusEntity.calculate()` всегда возвращают `sources: []` и не выставляют
  `quantity` (нет измеримой транзакционной единицы на уровне отдела/направления) — тот же паттерн,
  что уже используется правилами без счётной базы (`formatLineBasisNote` откатывается на «фикс за
  период»). Новые тесты (`SalaryAccruals/model/labels.spec.ts`,
  `SalaryReportData/model/labels.spec.ts`) фиксируют оба факта: `ROLE_LABEL(S).DEPARTMENT_HEAD` и
  корректный текст для `DepartmentPercent`/`DepartmentPlanBonus`/`DepartmentTurnoverBonus` через
  `formatLineMeta`/`getRuleTypeLabel` — red подтверждён (`ROLE_LABEL(S).DEPARTMENT_HEAD` было
  `undefined`, 2 упавших теста из 11), green — после добавления `DEPARTMENT_HEAD` в обе карты
  (`npx vitest run src/features/SalaryAccruals src/features/SalaryReportData` — 39 passed, без
  регрессий).

## 18. Frontend: `GoodsTurnoverReport` — переход на `totals` из API

- [ ] 18.1 Написать тесты: страница рендерит строку «Итого» из поля `totals` ответа API (а не через `summarizeGoodsTurnoverRows`/`summarizeShopGoodsTurnoverRows`); shop-версия корректно читает новую форму ответа `{lines, totals}`
- [ ] 18.2 Прогнать тесты из 18.1 и зафиксировать red
- [ ] 18.3 Удалить `model/{,shop/}goodsTurnoverTree.ts` (`summarizeGoodsTurnoverRows`/`summarizeShopGoodsTurnoverRows`) и подключить рендер «Итого» из `totals` ответа API (service + shop)
- [ ] 18.4 Прогнать тесты из 18.1 и зафиксировать green

## 19. Интеграционная проверка

- [ ] 19.1 Прогнать backend test suite для `domains/service/modules/accounting`, `domains/shop/modules/accounting`, `domains/{service,shop}/modules/warehouse` (`npm run test -- accounting` / `-- warehouse`) — без регрессий
- [ ] 19.2 Прогнать frontend test suite для `features/SalaryRuleForm`, `features/SalaryAccruals`, `features/SalaryReportData`, `pages/GoodsTurnoverReport` — без регрессий
- [ ] 19.3 Обновить `ENDPOINTS.md`, если описание ответа эндпоинта `GET .../goods-turnover-report/:period` (shop) требует пометки об изменении формы ответа
