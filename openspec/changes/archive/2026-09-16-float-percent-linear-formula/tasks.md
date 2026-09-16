## 1. Domain-логика

- [x] 1.1 В `backend/src/domains/service/modules/accounting/domain/services/float-percent.ts`,
      функция `resolveFloatPercentMultiplier` — заменить формулу LINEAR-ветки (интерполяцию между
      `current.multiplier` и `next.multiplier`) на `current.multiplier * (percentCompletion / 100)`
      (FR1 из `float-percent-linear-formula`); ветка `mode === 'FIX' || !next` не меняется (FR2).
      Обновить комментарий над функцией (описание семантики `mode`), чтобы он отражал новую формулу.
- [x] 1.2 Обновить комментарий к режиму `LINEAR` в `contracts/commands/salary-rule.ts`
      (`percentBorderSchema`, строки ~77–103) — убрать формулировку про интерполяцию к множителю
      следующего порога, описать пропорциональную формулу.

## 2. Тесты

- [x] 2.1 В `float-percent.spec.ts` обновить существующие кейсы на LINEAR-интерполяцию под новую
      формулу (в т.ч. точный кейс из бага: `fromPlanPercent: 70, multiplier: 1` /
      `fromPlanPercent: 120, multiplier: 1.2`, `percentCompletion: 95.59` →
      `multiplier ≈ 0.9559`, а не `1.10236`) и убедиться, что `npm run test -- float-percent`
      проходит.
- [x] 2.2 Добавить кейс на границу сегмента: `percentCompletion` равен `current.fromPlanPercent`
      (множитель = `current.multiplier * (fromPlanPercent/100)`, НЕ обязательно равен
      `current.multiplier`) и `percentCompletion` чуть ниже `next.fromPlanPercent` (множитель всё
      ещё считается от `current`, не от `next`) — проверить `npm run test -- float-percent` проходит.
- [x] 2.3 Проверить (по существующим тестам или добавить при отсутствии), что кейсы `mode: 'FIX'` и
      LINEAR-порог без `next` не изменили поведение (регрессия на FR2).

## 3. Проверка (service)

- [x] 3.1 Прогнать `npm run test -- accounting` (или более узкий фильтр по модулю
      `domains/service/modules/accounting`) в `backend/` — убедиться, что смежные тесты
      (`order-payed.entity.spec.ts`, e2e зарплатных отчётов, если есть) не сломаны новой формулой.
- [x] 3.2 `npm run lint` в `backend/` — без новых ошибок в изменённых файлах.

## 4. Domain-логика (shop) — FR3

- [x] 4.1 В `backend/src/domains/shop/modules/accounting/domain/value-objects/float-percent-schedule.value-object.ts`,
      метод `FloatPercentSchedule.resolveMultiplier` — заменить формулу LINEAR-ветки (интерполяцию
      между `current.multiplier` и `next.multiplier`) на `current.multiplier * (percentCompletion / 100)`,
      идентично `service`. Ветка `mode === 'FIX' || !next` не меняется. Обновить комментарий над
      методом.

## 5. Тесты (shop)

- [x] 5.1 В `float-percent-schedule.value-object.spec.ts` обновить существующие кейсы на
      LINEAR-интерполяцию под новую формулу и убедиться, что
      `npm run test -- float-percent-schedule` проходит.
- [x] 5.2 Прогнать `npm run test -- --testPathPatterns=domains/shop/modules/accounting` в `backend/`
      — обновить смежные тесты, которые опирались на старую LINEAR-интерполяцию
      (`department-plan-bonus.entity.spec.ts`, `department-turnover-bonus.entity.spec.ts`,
      `product-sold.entity.spec.ts` — уже используют LINEAR по grep), под новую формулу.
- [x] 5.3 `npm run lint` в `backend/` — без новых ошибок в изменённых файлах shop.

## 6. Проверка целиком (оба домена)

- [x] 6.1 Полный `npm run test` в `backend/` — убедиться, что ничего за пределами
      `domains/{service,shop}/modules/accounting` не сломано (общих потребителей
      `resolveFloatPercentMultiplier`/`FloatPercentSchedule` вне этих модулей нет, но проверить
      весь набор тестов дешевле, чем полагаться на это).
