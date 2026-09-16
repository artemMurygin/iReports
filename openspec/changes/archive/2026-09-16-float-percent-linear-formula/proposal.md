## Why

В зарплатных правилах `service` с плавающим процентом (`award.type: 'FloatPercent'`) множитель на
LINEAR-участке между двумя порогами интерполируется между `multiplier` нижнего и `multiplier`
верхнего порога. Это даёт контринтуитивный результат: при невыполненном плане продаж (например,
95.59% при пороге «Выполнение плана» `fromPlanPercent: 70, multiplier: 1` и следующем пороге
«Перевыполнение» `fromPlanPercent: 120, multiplier: 1.2`) множитель уже превышает 1
(`1.10236` → `appliedPercent = 5.5118%` при базовых 5%), то есть сотрудник получает **больше**
базового процента, хотя план не выполнен. Нужна формула, где на LINEAR-участке множитель прямо
пропорционален проценту выполнения плана, а не месту между multiplier'ами двух порогов.

## What Changes

- **BREAKING** (поведение расчёта зарплаты, не API-контракт): для `mode: 'LINEAR'` формула
  множителя на участке `[current.fromPlanPercent, next.fromPlanPercent)` меняется с интерполяции
  между `current.multiplier` и `next.multiplier` на `current.multiplier × (percentCompletion / 100)`.
  `multiplier` порога `next` в этой формуле больше не используется — он начинает влиять на расчёт
  только когда сам становится текущим порогом (`current`).
- Поведение для `mode: 'FIX'` и для LINEAR-порога без следующего (`next` отсутствует) не меняется —
  возвращается `current.multiplier` как есть.
- Поведение «процент выполнения плана ниже самого нижнего порога → множитель равен нулю» не
  меняется.
- Тот же принцип применяется к независимой зеркальной реализации в `domains/shop`
  (`FloatPercentSchedule.resolveMultiplier()`, `float-percent-schedule.value-object.ts`) —
  Q1 закрыт пользователем: формула нужна в обоих доменах (см. FR3).

## Functional Requirements

- **FR1**: Для `mode: 'LINEAR'` порога с существующим следующим порогом (`next`) множитель на
  участке `[current.fromPlanPercent, next.fromPlanPercent)` вычисляется как
  `current.multiplier × (percentCompletion / 100)` — без использования `next.multiplier`.
- **FR2**: Поведение для `mode: 'FIX'`, для LINEAR-порога без `next`, и для процента выполнения
  плана ниже самого нижнего порога (`multiplier = 0`) остаётся без изменений.
- **FR3**: Та же формула (FR1/FR2) применяется в независимой реализации домена `shop`
  (`FloatPercentSchedule.resolveMultiplier()`), чтобы поведение не расходилось между направлениями
  при идентичной семантике порогов.

## Capabilities

### New Capabilities

_(нет)_

### Modified Capabilities

- `service/accounting`: требование «Множитель по проценту выполнения плана — ступенчатый или
  линейный» — меняется формула LINEAR-режима и её сценарий.
- `shop/accounting`: то же требование добавляется впервые (ADDED — в спеке `shop/accounting` этого
  требования ещё не было, хотя код `FloatPercentSchedule` уже существовал с прежней формулой
  интерполяции; спека и код обновляются одновременно, сразу на новую формулу).

## Impact

- **Код**: `backend/src/domains/service/modules/accounting/domain/services/float-percent.ts`
  (`resolveFloatPercentMultiplier`) и его юнит-тесты
  (`float-percent.spec.ts`).
- **Контракт** (`contracts/commands/salary-rule.ts`, комментарий к `percentBorderSchema`,
  строки ~77–103): описание режима `LINEAR` в комментарии нужно поправить под новую формулу
  (сам JSON-контракт формы порога `{ name, fromPlanPercent, multiplier, mode }` не меняется).
- **Код (shop)**: `backend/src/domains/shop/modules/accounting/domain/value-objects/float-percent-schedule.value-object.ts`
  (`FloatPercentSchedule.resolveMultiplier()`) и его юнит-тесты
  (`float-percent-schedule.value-object.spec.ts`) — то же изменение формулы, независимая реализация.
- **Деньги**: расчёт `OrderPayedEntity.calculate()` (`service`) и всех правил `shop`, использующих
  `FloatPercentSchedule.resolveMultiplier()` (`ProductSoldEntity`, `DepartmentPlanBonusEntity`,
  `DepartmentTurnoverBonusEntity` и др., где применим `award.type: 'FloatPercent'`/
  `percentBorders`) — меняются суммы начислений по всем зарплатным правилам обоих доменов, где
  используется хотя бы один LINEAR-порог с существующим следующим порогом. Отчёты
  (`appliedPercent`, `floatPercent.fact/prognose`) отражают новые числа автоматически, без изменения
  формы ответа.
