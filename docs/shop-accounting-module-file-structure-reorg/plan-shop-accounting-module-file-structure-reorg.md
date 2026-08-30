# Plan: Shop Accounting Module File Structure Reorganization

**PRD**: [prd-shop-accounting-module-file-structure-reorg.md](./prd-shop-accounting-module-file-structure-reorg.md)
**Дата**: 2026-08-28

Порядок фаз — от самого изолированного кластера к самому крупному/сквозному: `payout` (Tracer
Bullet, минимум файлов, ни ports, ни mappers) → `task-completion` → `motivation-schema` → `accounting-period`
→ `salary-accrual` (самый крупный) → `erp-cash` → `salary-report` → `calculation` (сквозной,
используется несколькими предыдущими кластерами — переносится последним, когда все потребители уже
переехали). Каждая фаза самостоятельна: после неё модуль собирается и тесты зелёные, можно
остановиться на любой фазе. `domain/` и `infrastructure/` не трогаются ни в одной фазе (вне скоупа
PRD).

Общий паттерн задач внутри каждой фазы (переиспользуется, конкретные файлы — см. список фазы):
1. Перенести файлы `application/{command,services,mappers,ports}` кластера в подпапку `{cluster}/`
   через `git mv` (файл + его `.spec.ts` — вместе).
2. Перенести файлы `interface/{http-controllers,dto}` кластера в подпапку `{cluster}/` через `git mv`.
3. Обновить относительные импорты во всех перенесённых и ссылающихся на них файлах, включая
   `accounting.module.ts`.
4. Прогнать `npm run lint && npm run test && npm run build` для `backend/`, убедиться в отсутствии
   регрессий (тот же набор проходящих/падающих тестов, что и до переноса).

---

## Фаза 1: Tracer Bullet — кластер `payout`

**Цель**: Провести один кластер через оба слоя (`application` + `interface`) и зафиксировать паттерн
переноса/правки импортов для всех последующих фаз. Кластер `payout` не имеет собственных
`ports`/`mappers`/`services` — минимальный риск и объём.
**Что затрагивает?** backend

**Задачи:**
- [ ] `git mv` в `application/command/payout/`: `create-shop-payout.{command,handler,handler.spec}.ts`,
      `create-shop-payout-batch.{command,handler,handler.spec}.ts`,
      `delete-shop-payout.{command,handler,handler.spec}.ts`.
- [ ] `git mv` в `interface/http-controllers/payout/`: `create-payout.http.controller.ts`,
      `create-payout-batch.http.controller.ts`, `delete-payout.http.controller.ts`;
      в `interface/dto/payout/`: `create-payout.dto.ts`, `payout-batch.dto.ts`.
- [ ] Обновить импорты в `accounting.module.ts` и во всех файлах, ссылающихся на перенесённые
      пути (`grep -rn "command/create-shop-payout\|command/delete-shop-payout\|http-controllers/create-shop-payout\|http-controllers/delete-shop-payout\|dto/create-shop-payout\|dto/shop-payout-batch" backend/src`).
- [ ] `npm run lint && npm run test && npm run build` в `backend/` — зелёные, без изменения состава
      падающих тестов.

**Когда готово**: Кластер `payout` полностью лежит в подпапках `payout/` слоёв `application/command`
и `interface/{http-controllers,dto}`; ни один импорт не сломан; `lint/test/build` проходят.

---

## Фаза 2: Кластер `task-completion`

**Цель**: Перенести use case'ы выполнения задач в единый кластер во всех задействованных слоях.
**Что затрагивает?** backend

**Задачи:**
- [ ] `git mv` в `application/command/task-completion/`:
      `create-shop-task-completion.{command,handler,handler.spec}.ts`,
      `confirm-shop-task-completion.{command,handler,handler.spec}.ts`,
      `delete-shop-task-completion.{command,handler,handler.spec}.ts`.
- [ ] `git mv` в `application/services/task-completion/`: `list-task-completions.service.ts`;
      в `application/mappers/task-completion/`: `to-task-completion-response.ts`;
      в `application/ports/task-completion/`: `task-completion.port.ts`.
- [ ] `git mv` в `interface/http-controllers/task-completion/`:
      `create-task-completion.http.controller.ts`,
      `confirm-task-completion.http.controller.ts`,
      `delete-task-completion.http.controller.ts`,
      `list-task-completions.http.controller.ts`;
      в `interface/dto/task-completion/`: `task-completion-confirm.dto.ts`,
      `task-completion-create.dto.ts`, `task-completion-list-query.dto.ts`,
      `task-completion-reject.dto.ts`.
- [ ] Обновить импорты (включая `accounting.module.ts`) и прогнать
      `npm run lint && npm run test && npm run build`.

**Когда готово**: Кластер `task-completion` целиком в подпапках `task-completion/` во всех
задействованных слоях; `lint/test/build` проходят без регрессий.

---

## Фаза 3: Кластер `motivation-schema` (включая правила зарплаты)

**Цель**: Перенести схемы мотивации и связанные с ними правила зарплаты (`create-shop-salary-rule`,
`list-salary-rule-types`) в единый кластер — по решению из PRD правила считаются частью мотивационной
схемы.
**Что затрагивает?** backend

**Задачи:**
- [ ] `git mv` в `application/command/motivation-schema/`:
      `create-shop-motivation-schema.{command,handler,handler.spec}.ts`,
      `update-shop-motivation-schema.{command,handler,handler.spec}.ts`,
      `create-shop-salary-rule.{command,handler,handler.spec}.ts`.
- [ ] `git mv` в `application/services/motivation-schema/`: `get-motivation-schema.service.{ts,spec.ts}`,
      `list-motivation-schemas.service.{ts,spec.ts}`, `list-salary-rule-types.service.ts`;
      в `application/mappers/motivation-schema/`: `to-motivation-schema-response.ts`,
      `to-motivation-schema-list-item.ts`;
      в `application/ports/motivation-schema/`: `motivation-schema.port.ts`, `salary-rule.port.ts`.
- [ ] `git mv` в `interface/http-controllers/motivation-schema/`:
      `create-motivation-schema.http.controller.ts`,
      `update-motivation-schema.http.controller.ts`,
      `get-motivation-schema.http.controller.ts`,
      `list-motivation-schemas.http.controller.ts`,
      `list-salary-rule-types.http.controller.ts`;
      в `interface/dto/motivation-schema/`: `motivation-schema-create.dto.ts`,
      `update-motivation-schema.dto.ts`, `list-motivation-schemas-query.dto.ts`.
- [ ] Обновить импорты (включая `accounting.module.ts`) и прогнать
      `npm run lint && npm run test && npm run build`.

**Когда готово**: Кластер `motivation-schema` целиком в подпапках `motivation-schema/`;
`lint/test/build` проходят без регрессий.

---

## Фаза 4: Кластер `accounting-period`

**Цель**: Перенести жизненный цикл расчётного периода (закрытие/переоткрытие/пересчёт) в единый
кластер.
**Что затрагивает?** backend

**Задачи:**
- [ ] `git mv` в `application/command/accounting-period/`:
      `close-shop-accounting-period.{command,handler,handler.spec}.ts`,
      `reopen-shop-accounting-period.{command,handler}.ts`,
      `recalculate-shop-accounting-period.{command,handler}.ts`.
- [ ] `git mv` в `application/services/accounting-period/`: `get-accounting-period.service.ts`,
      `get-close-period-preview.service.ts`;
      в `application/mappers/accounting-period/`: `to-accounting-period-response.ts`;
      в `application/ports/accounting-period/`: `accounting-period.port.ts`,
      `accounting-period-snapshot.port.ts`.
- [ ] `git mv` в `interface/http-controllers/accounting-period/`:
      `close-accounting-period.http.controller.ts`,
      `close-accounting-period.work-schedule-independence.e2e.spec.ts`,
      `reopen-accounting-period.http.controller.ts`,
      `recalculate-accounting-period.http.controller.ts`,
      `get-accounting-period.http.controller.ts`,
      `get-close-period-preview.http.controller.ts`;
      в `interface/dto/accounting-period/`: `reopen-accounting-period.dto.ts`.
- [ ] Обновить импорты (включая `accounting.module.ts`) и прогнать
      `npm run lint && npm run test && npm run build`.

**Когда готово**: Кластер `accounting-period` целиком в подпапках `accounting-period/`;
`lint/test/build` проходят без регрессий.

---

## Фаза 5: Кластер `salary-accrual` (самый крупный)

**Цель**: Перенести начисление/корректировку/отмену строк начисления — крупнейший кластер модуля.
**Что затрагивает?** backend

**Задачи:**
- [ ] `git mv` в `application/command/salary-accrual/`:
      `accrue-period-shop-salary-accruals.{command,handler}.ts`,
      `accrue-shop-salary-accrual-document.{command,handler}.ts`,
      `accrue-shop-salary-accrual-line.{command,handler}.ts`,
      `adjust-shop-salary-accrual-line.{command,handler}.ts`,
      `unaccrue-shop-salary-accrual-line.{command,handler}.ts`,
      `accrue-draft-lines.helper.ts`.
- [ ] `git mv` в `application/services/salary-accrual/`: `get-salary-accrual.service.ts`,
      `list-salary-accruals.service.ts`;
      в `application/mappers/salary-accrual/`: `to-salary-accrual-response.ts`;
      в `application/ports/salary-accrual/`: `salary-accrual.port.ts`.
- [ ] `git mv` в `interface/http-controllers/salary-accrual/`:
      `accrue-period-salary-accruals.http.controller.ts`,
      `accrue-salary-accrual-document.http.controller.ts`,
      `accrue-salary-accrual-line.http.controller.ts`,
      `adjust-salary-accrual-line.http.controller.ts`,
      `unaccrue-salary-accrual-line.http.controller.ts`,
      `get-salary-accrual.http.controller.ts`,
      `list-salary-accruals.http.controller.ts`,
      `salary-accruals.e2e.spec.ts`;
      в `interface/dto/salary-accrual/`: `accrue-salary-accrual-line.dto.ts`,
      `adjust-salary-accrual-line.dto.ts`, `list-salary-accruals-query.dto.ts`.
- [ ] Обновить импорты (включая `accounting.module.ts`) и прогнать
      `npm run lint && npm run test && npm run build`.

**Когда готово**: Кластер `salary-accrual` целиком в подпапках `salary-accrual/`; `lint/test/build`
проходят без регрессий.

---

## Фаза 6: Кластер `erp-cash`

**Цель**: Перенести конфигурацию и документы ERP-кассы в единый кластер.
**Что затрагивает?** backend

**Задачи:**
- [ ] `git mv` в `application/services/erp-cash/`: `get-erp-cash-config.service.ts`;
      в `application/mappers/erp-cash/`: `to-erp-cash-config-response.ts`,
      `to-erp-cash-document-response.ts`;
      в `application/ports/erp-cash/`: `erp-cash-config.port.ts`,
      `erp-cash-document-repository.port.ts`, `erp-cash-document.port.ts`.
- [ ] `git mv` в `interface/http-controllers/erp-cash/`: `get-erp-cash-config.http.controller.ts`.
- [ ] Обновить импорты (включая `accounting.module.ts`) и прогнать
      `npm run lint && npm run test && npm run build`.

**Когда готово**: Кластер `erp-cash` целиком в подпапках `erp-cash/`; `lint/test/build` проходят без
регрессий.

---

## Фаза 7: Кластер `salary-report`

**Цель**: Перенести отчёты по зарплате сотрудника/отдела в единый кластер.
**Что затрагивает?** backend

**Задачи:**
- [ ] `git mv` в `application/services/salary-report/`: `get-employee-salary-report.service.{ts,spec.ts}`,
      `get-department-salary-report.service.{ts,spec.ts}`;
      в `application/mappers/salary-report/`: `to-salary-report-rules.{ts,spec.ts}`,
      `to-sales-performance-context.ts`, `to-sales-performance-summary.ts`.
- [ ] `git mv` в `interface/http-controllers/salary-report/`:
      `get-employee-salary-report.http.controller.ts`,
      `get-employee-salary-report.e2e.spec.ts`,
      `get-department-salary-report.http.controller.ts`.
- [ ] Обновить импорты (включая `accounting.module.ts`) и прогнать
      `npm run lint && npm run test && npm run build`.

**Когда готово**: Кластер `salary-report` целиком в подпапках `salary-report/`; `lint/test/build`
проходят без регрессий.

---

## Фаза 8: Кластер `calculation` (сквозной) и финальная проверка

**Цель**: Перенести сквозную расчётную инфраструктуру последней (когда все клиенты уже переехали в
свои кластеры) и подтвердить, что весь модуль соответствует критериям готовности PRD.
**Что затрагивает?** backend

**Задачи:**
- [ ] `git mv` в `application/services/calculation/`: `build-calculation-context.service.{ts,spec.ts}`,
      `calculate-snapshot-rows.service.ts`, `resolve-employee-salary-rules.service.{ts,spec.ts}`.
- [ ] `git mv` в `application/ports/calculation/`: `calculation-data.port.ts`,
      `snapshot-rows-calculator.port.ts`, `accounting-calculation-cache.port.ts`.
- [ ] Обновить импорты (включая `accounting.module.ts`) и прогнать
      `npm run lint && npm run test && npm run build`.
- [ ] Финальная проверка по критериям готовности PRD: ни одна из папок
      `application/{command,services,mappers,ports}` и `interface/{http-controllers,dto}` не содержит
      файлов вне подпапок кластеров (кроме случаев, где у слоя нет файлов данного кластера); ни один
      файл не задублирован в двух кластерах; `git log --follow` находит историю каждого перенесённого
      файла.
- [ ] Обновить `docs/shop-accounting-ddd-review.md` (раздел не требуется — файл менять не нужно, если
      ссылки на пути в нём не сломались; проверить grep'ом упомянутые в нём пути на актуальность).

**Когда готово**: Все 8 кластеров перенесены; `lint/test/build` зелёные; критерии готовности PRD
выполнены полностью.
