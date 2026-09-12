## Why

Мотивационная схема (`motivation-schema`) поддерживает создание, просмотр, список и редактирование (PATCH), но не поддерживает удаление. Схема, заведённая по ошибке или ставшая ненужной (например, дублирующая роль при реорганизации), остаётся в системе навсегда — единственный обходной путь — переименовать её и вручную занулить правила, что засоряет список схем и вводит пользователей в заблуждение.

## What Changes

- **FR1**: пользователь может полностью удалить мотивационную схему направления `service` по id (`DELETE /v1/service/motivation-schema/:id`); удаление необратимо (soft-delete не вводится).
- **FR2**: пользователь может полностью удалить мотивационную схему направления `shop` по id (`DELETE /v1/shop/accounting/motivation-schema/:id`); симметрично FR1.
- **FR3**: удаление схемы одного направления не затрагивает правила/имя другого направления той же физически общей строки `motivation_schemas` — родительская строка удаляется только тогда, когда после удаления правил своего направления у неё не осталось правил другого направления.
- **FR4**: страница редактирования схемы (`SalaryRuleDetail`, оба направления) получает кнопку «Удалить схему» и модальное окно подтверждения (по образцу `DeletePayoutDialog`/`DeleteIdentityModal`, на базе `shared/ui-kit` `Modal`); после успешного удаления — редирект на список схем и инвалидация кеша списка (`['salary-rule-list']`).

## Capabilities

### New Capabilities
_(нет — используется существующая доменная область accounting)_

### Modified Capabilities
- `service/accounting`: добавляется требование — пользователь может полностью удалить мотивационную схему направления service по id.
- `shop/accounting`: добавляется требование — пользователь может полностью удалить мотивационную схему направления shop по id.

## Impact

- Backend: `backend/src/domains/service/modules/accounting/{domain,application,interface}` и `backend/src/domains/shop/modules/accounting/{domain,application,interface}` (доменная сущность `MotivationSchema`, новый command/handler, новый HTTP-контроллер), `backend/src/config/app.routes.ts`, `accounting.module.ts` обоих доменов.
- Frontend: `frontend/src/pages/SalaryRuleDetail/service` и `.../shop` (кнопка удаления, модалка подтверждения, мутация-хук), `frontend/src/app/router.tsx` (редирект после удаления на маршрут списка схем).
- Contracts: при необходимости — типы для DELETE-запроса в `contracts/commands/motivation-schema.ts` и `contracts/commands/shop-motivation-schema.ts`.
- Изменений в БД-схеме (Prisma) не требуется — используется штатное удаление записи и связанных с ней правил.
