## Why

Пилотный change `docs-migration-to-openspec` перенёс в `openspec/specs/` бизнес-документацию только
одного модуля домена `service` — `modules/accounting` — и закрепил конвенцию `openspec/specs/` +
`spec:`-ссылок (`openspec/specs/conventions/documentation/spec.md`). Остальная функциональность
домена `service` (`modules/sales`, `modules/reports`, `modules/marketing/pricing`, `sync/roapp`) до
сих пор документирована лишь фрагментарно прозой в `backend/src/domains/service/CLAUDE.md` или не
документирована вовсе (`reports`, `marketing/pricing` описаны в CLAUDE.md одной строкой), а бизнес-
правила внутри кода (формула KPI заказа, топологическая сортировка категорий, курсор докатки при
сбое синка, автосоздание планов продаж и т.д.) остаются только в комментариях или вообще нигде не
зафиксированы. Это тот же разрыв, который решал пилот, — просто для остальной части одного и того же
домена.

Нужно завершить перенос документации домена `service` в `openspec/specs/` по уже проверенному на
пилоте шаблону, прежде чем распространять его на домен `shop` и на общие
backend/frontend-паттерны — это предмет последующих changes (см. Impact).

## What Changes

- Создать поведенческие спеки для оставшихся модулей домена `service`, ещё не покрытых пилотом:
  `modules/sales` (план/факт/прогноз продаж + сделки/лиды), `modules/reports` (аналитика проданных
  услуг и справочник категорий), `modules/marketing/pricing` (обновление цен/себестоимости услуг
  RoApp), `sync/roapp` (синхронизация с ERP: порядок upsert, курсор докатки при сбое, расчёт KPI
  заказа).
- Заменить соответствующие разделы `backend/src/domains/service/CLAUDE.md` (`modules/sales`,
  `sync/roapp`) на краткие указатели на спеки — по аналогии с уже сделанным для
  `modules/accounting`; для `reports`/`marketing/pricing`, которые в CLAUDE.md описаны одной строкой
  без отдельного раздела, добавить такой раздел-указатель.
- Точечно зачистить объяснительные ("почему") комментарии в коде затронутых модулей, заменив
  бизнес-правило-объясняющие на `spec: <capability-path>#<anchor>` — по тому же критерию, что
  зафиксирован в `conventions/documentation` (архитектурные пояснения не переносятся).
- **Область, не входящая в этот change**: домен `shop` целиком (`domains/shop/**`, свой
  `CLAUDE.md`, но ни одного спека нет), интеграционный слой `integrations/roapp` /
  `integrations/custom-api-roapp` / `integrations/roapp-gateway` (это в основном API-обёртки без
  самостоятельных бизнес-правил — остаются архитектурным описанием в CLAUDE.md, не спеком), устаревший
  модуль `salary` (`/salary-rules/*`, предшественник `accounting`, ещё не вытеснен — см.
  `domains/service/CLAUDE.md` → "Функциональность домена, ещё не перенесённая"), общие
  backend/frontend-паттерны (FSD-слои, DDD-база) — всё это последующие changes по тому же шаблону.

## Capabilities

### New Capabilities
- `service/sales`: план/факт/прогноз продаж (шаблон плана, план на период, автосоздание планов,
  пересчёт факта/прогноза поверх RoApp) и сделки/лиды (read-side воронки Bitrix24 и заказов RoApp)
  модуля `modules/sales` — перенесено из `backend/src/domains/service/CLAUDE.md`.
- `service/reports`: аналитика проданных услуг и справочник категорий услуг модуля `modules/reports`.
- `service/marketing`: обновление цен и себестоимости услуг RoApp модуля `modules/marketing/pricing`.
- `service/roapp-sync`: правила синхронизации ERP RoApp → локальная БД (`sync/roapp`) — порядок
  операций, курсор докатки при сбое, расчёт KPI заказа (`cost`/`engineerSalary`/`managerSalary`).

### Modified Capabilities
(нет — все перечисленные капабилити создаются впервые; `service/accounting` этим change не
затрагивается)

## Impact

- **Документация**: `backend/src/domains/service/CLAUDE.md` — разделы `modules/sales` и `sync/roapp`
  сокращаются до указателей на спеки; для `reports`/`marketing/pricing` добавляются аналогичные
  короткие разделы-указатели вместо текущих однострочных упоминаний.
- **Код**: объяснительные комментарии в `backend/src/domains/service/modules/{sales,reports,
  marketing}/**` и `backend/src/domains/service/sync/roapp/**` заменяются на `spec:`-ссылки или
  удаляются — по тому же критерию, что применялся в пилоте к `modules/accounting`.
- **Тулинг**: используется уже существующий валидатор `spec:`-ссылок
  (`openspec/scripts/validate-spec-refs.mjs`) — новый инструментарий не требуется, только прогон на
  затронутых модулях.
- **Дальнейшие области** (домен `shop` целиком, интеграционный слой RoApp, устаревший модуль
  `salary`, общие backend/frontend-паттерны) документируются последующими changes по этому же
  шаблону — не в рамках данного change.
