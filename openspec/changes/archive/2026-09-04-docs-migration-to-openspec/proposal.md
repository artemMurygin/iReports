## Why

Архитектурная и доменная документация проекта сейчас живёт только в виде прозы в CLAUDE.md-файлах
(корневой, `backend/CLAUDE.md`, `frontend/CLAUDE.md`, `backend/src/domains/service/CLAUDE.md`,
`backend/src/domains/shop/CLAUDE.md`) и в объяснительных ("почему") комментариях, разбросанных по
коду. У этого нет структуры, которую можно точечно запрашивать/ревьюить/держать в актуальном
состоянии, а комментарии в коде дублируют или расходятся с прозой в CLAUDE.md и протухают при
рефакторинге. `openspec/` в проекте уже используется для change-предложений
(`openspec/changes/salary-rule-bitrix-task`), но дерева `openspec/specs/` (постоянного source of
truth по капабилити) пока нет вообще.

Нужно перенести документацию в `openspec/specs/`, ввести конвенцию `// spec: <capability>#<anchor>`
для объяснительных комментариев в коде вместо инлайн-прозы, и проверить весь подход на одном
реальном модуле, прежде чем тиражировать на остальные домены.

## What Changes

- Создать дерево `openspec/specs/` со структурой по границам DDD-модулей/FSD-слоёв.
- Ввести и задокументировать как отдельную капабилити конвенцию ссылок из кода на спеки:
  `// spec: <capability-path>#<anchor>` (тот же принцип якорей, что уже используется для
  перекрёстных ссылок между CLAUDE.md, например `../CLAUDE.md#knowledge-graph-graphify`).
- Определить требования к валидатору (lint/CI-скрипту), который проверяет, что каждый `spec:` id в
  коде резолвится в существующий файл+якорь под `openspec/specs/` — сама реализация валидатора
  переносится в задачи (`tasks.md`) этого change и последующие.
- В качестве пилота — полностью перенести содержимое `domains/service/CLAUDE.md` (раздел
  `modules/accounting`) и релевантные части `backend/CLAUDE.md` в
  `openspec/specs/service/accounting/spec.md`, заменить соответствующий раздел
  `domains/service/CLAUDE.md` на краткий указатель на спек.
- **Область последующих доменов (sales, reports, marketing-pricing, roapp-интеграции, домен `shop`
  целиком, общие backend/frontend паттерны) в этот change не входит** — это отдельные будущие
  changes по тому же шаблону, что закладывается здесь (см. Impact).
- Зачистка объяснительных комментариев в коде — только для `modules/accounting` в рамках этого
  change (пилот); для остальных модулей — последующие changes.

## Capabilities

### New Capabilities
- `conventions/documentation`: конвенция структуры `openspec/specs/`, схема id-ссылок
  `// spec: <capability>#<anchor>` в коде и требования к скрипту-валидатору этих ссылок.
- `service/accounting`: спецификация модуля начисления зарплаты/расчётного периода/отчётов
  домена `service` (мотивационные схемы, зарплатные правила, `AccountingPeriod`, снапшоты,
  зарплатные отчёты) — перенесена из `backend/src/domains/service/CLAUDE.md`.

### Modified Capabilities
(нет — `openspec/specs/` создаётся с нуля, изменяемых существующих спеков нет)

## Impact

- **Документация**: `backend/src/domains/service/CLAUDE.md` (раздел `modules/accounting` сокращается
  до указателя на спек), возможно точечные правки `backend/CLAUDE.md` (ссылка на конвенцию).
- **Код**: объяснительные комментарии в
  `backend/src/domains/service/modules/accounting/**` заменяются на `// spec:` id или удаляются
  (если чисто описательные).
- **Тулинг**: новый скрипт-валидатор `spec:`-ссылок (место и способ подключения к CI/lint —
  решается в `design.md` и реализуется в `tasks.md`).
- **Дальнейшие домены/модули** (sales, reports, marketing-pricing, roapp-интеграции, весь `shop`,
  `shared/ddd-layering`, `shared/fsd-frontend`) документируются последующими changes по этому же
  шаблону — не в рамках данного change.
- **Известный пробел, обнаруженный при сверке спека с кодом (задача 3.2):** в `modules/accounting`
  есть ещё один пласт бизнес-логики — документ начисления `SalaryAccrual`/`SalaryAccrualLine` и
  выплаты `Payout` (статусы `DRAFT → PARTIALLY_ACCRUED → ACCRUED → PAID`, рождается при закрытии
  периода; см. PRD `docs/payroll-closing-and-accrual/prd-accounting-period-closing-pipeline.md`).
  Он не описан ни в `domains/service/CLAUDE.md`, ни в этом спеке — `service/accounting/spec.md`
  сознательно покрывает только то, что было в CLAUDE.md (мотивационная схема, зарплатные правила,
  расчётный период, отчёты). Документирование `SalaryAccrual`/`Payout` — предмет отдельного
  последующего change по этому же шаблону, не этого.
