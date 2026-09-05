# Plan: Service Accounting Module File Structure Reorganization

**PRD**: [prd-service-accounting-module-file-structure-reorg.md](./prd-service-accounting-module-file-structure-reorg.md)
**Дата**: 2026-09-04

Порядок фаз повторяет логику плана shop — от самого изолированного кластера (Tracer Bullet) к самому
крупному/сквозному, затем слои, которых у shop вообще нет (`application/events`), затем `domain/entities`,
затем точечные переименования и мёртвый код, и в конце — перенос конфигурации кассы вместе с финальной
проверкой. Каждая фаза самостоятельна: после неё модуль собирается и тесты зелёные, можно остановиться на
любой фазе.

Общий паттерн задач внутри фаз 1–7 (переиспользуется, конкретные файлы — см. список фазы):
1. Перенести файлы `application/{command,services,ports}` кластера в подпапку `{cluster}/` через `git mv`
   (файл + его `.spec.ts` — вместе).
2. Перенести файлы `interface/{http-controllers,dto}` кластера в подпапку `{cluster}/` через `git mv`.
3. Обновить импорты во всех перенесённых и ссылающихся на них файлах, включая `accounting.module.ts`.
4. Прогнать `npm run lint && npm run test && npm run build` для `backend/`, без регрессий.

---

## Фаза 1: Tracer Bullet — кластер `erp-cash-payout`

**Цель**: Провести один кластер через `application` и `interface` целиком, зафиксировать паттерн переноса и
правки импортов для всех последующих фаз. Кластер не имеет собственных `ports`/`services` (конфигурация кассы
и порты живут в отдельном кластере `erp-cash`, см. Фазу 5) — минимальный риск.
**Что затрагивает?** backend

**Задачи:**
- [ ] `git mv` в `application/command/erp-cash-payout/`: `create-payout.{command,handler,handler.spec}.ts`,
      `create-payout-batch.{command,handler,handler.spec}.ts`, `delete-payout.{command,handler,handler.spec}.ts`.
- [ ] `git mv` в `interface/http-controllers/erp-cash-payout/`: `create-payout.http.controller.ts`,
      `create-payout-batch.http.controller.ts`, `delete-payout.http.controller.ts`, `payout.e2e.spec.ts`;
      в `interface/dto/erp-cash-payout/`: `create-payout.dto.ts`, `payout-batch.dto.ts`.
- [ ] Обновить импорты в `accounting.module.ts` и во всех файлах, ссылающихся на перенесённые пути
      (`grep -rn "accounting/application/command/create-payout\|accounting/application/command/delete-payout\|accounting/interface/http-controllers/create-payout\|accounting/interface/http-controllers/delete-payout\|accounting/interface/dto/create-payout\|accounting/interface/dto/payout-batch" backend/src`).
- [ ] `npm run lint && npm run test && npm run build` в `backend/` — без изменения состава падающих тестов.

**Когда готово**: Кластер `erp-cash-payout` полностью лежит в подпапках `erp-cash-payout/` слоёв
`application/command` и `interface/{http-controllers,dto}`; ни один импорт не сломан; `lint/test/build` зелёные.

---

## Фаза 2: Кластер `motivation-schema`

**Цель**: Перенести схемы мотивации и связанные с ними правила зарплаты в единый кластер (как в shop —
правила зарплаты считаются частью мотивационной схемы).
**Что затрагивает?** backend

**Задачи:**
- [ ] `git mv` в `application/command/motivation-schema/`: `create-motivation-schema.{command,handler,handler.spec}.ts`,
      `update-motivation-schema.{command,handler,handler.spec}.ts`, `create-salary-rule.{command,handler,handler.spec}.ts`.
- [ ] `git mv` в `application/ports/motivation-schema/`: `motivation-schema.port.ts`, `salary-rule.port.ts`;
      в `application/services/motivation-schema/`: `get-motivation-schema.service.{ts,spec.ts}`,
      `list-motivation-schemas.service.{ts,spec.ts}`, `list-salary-rule-types.service.ts`.
- [ ] `git mv` в `interface/http-controllers/motivation-schema/`: `create-motivation-schema.http.controller.{ts,spec.ts}`,
      `update-motivation-schema.http.controller.{ts,spec.ts}`, `get-motivation-schema.http.controller.{ts,spec.ts}`,
      `list-motivation-schemas.http.controller.{ts,spec.ts}`, `list-salary-rule-types.http.controller.ts`;
      в `interface/dto/motivation-schema/`: `motivation-schema-create.dto.ts`, `update-motivation-schema.dto.ts`,
      `list-motivation-schemas-query.dto.ts`.
- [ ] Обновить импорты (включая `accounting.module.ts`) и прогнать `npm run lint && npm run test && npm run build`.

**Когда готово**: Кластер `motivation-schema` целиком в подпапках `motivation-schema/`; `lint/test/build` без
регрессий.

---

## Фаза 3: Кластер `accounting-period`

**Цель**: Перенести жизненный цикл расчётного периода (закрытие/переоткрытие/пересчёт) в единый кластер.
**Что затрагивает?** backend

**Задачи:**
- [ ] `git mv` в `application/command/accounting-period/`: `close-accounting-period.{command,handler,handler.spec}.ts`,
      `close-accounting-period.direction-independence.spec.ts`, `reopen-accounting-period.{command,handler,handler.spec}.ts`,
      `recalculate-accounting-period.{command,handler,handler.spec}.ts`.
- [ ] `git mv` в `application/ports/accounting-period/`: `accounting-period.port.ts`,
      `accounting-period-snapshot.port.ts`; в `application/services/accounting-period/`:
      `ensure-period-not-closed.service.{ts,spec.ts}`, `get-accounting-period.service.ts`,
      `get-close-period-preview.service.{ts,spec.ts}`.
- [ ] `git mv` в `interface/http-controllers/accounting-period/`: `close-accounting-period.http.controller.ts`,
      `reopen-accounting-period.http.controller.ts`, `recalculate-accounting-period.http.controller.ts`,
      `get-accounting-period.http.controller.ts`, `get-close-period-preview.http.controller.ts`;
      в `interface/dto/accounting-period/`: `reopen-accounting-period.dto.ts`.
- [ ] Обновить импорты (включая `accounting.module.ts`) и прогнать `npm run lint && npm run test && npm run build`.

**Когда готово**: Кластер `accounting-period` целиком в подпапках `accounting-period/`; `lint/test/build` без
регрессий.

---

## Фаза 4: Кластер `salary-accrual` (самый крупный)

**Цель**: Перенести начисление/корректировку/отмену строк начисления — крупнейший кластер модуля.
**Что затрагивает?** backend

**Задачи:**
- [ ] `git mv` в `application/command/salary-accrual/`: `accrue-period-salary-accruals.{command,handler,handler.spec}.ts`,
      `accrue-salary-accrual-document.{command,handler,handler.spec}.ts`,
      `accrue-salary-accrual-line.{command,handler,handler.spec}.ts`,
      `adjust-salary-accrual-line.{command,handler,handler.spec}.ts`,
      `unaccrue-salary-accrual-line.{command,handler,handler.spec}.ts`, `accrue-draft-lines.helper.ts`,
      `set-task-rule-actual-amount.command.ts` (стаб без хендлера — переносится как есть, см. PRD «Открытые вопросы»).
- [ ] `git mv` в `application/ports/salary-accrual/`: `salary-accrual.port.ts`; в
      `application/services/salary-accrual/`: `get-salary-accrual.service.ts`, `list-salary-accruals.service.ts`.
- [ ] `git mv` в `interface/http-controllers/salary-accrual/`: `accrue-period-salary-accruals.http.controller.ts`,
      `accrue-salary-accrual-document.http.controller.ts`, `accrue-salary-accrual-line.http.controller.ts`,
      `adjust-salary-accrual-line.http.controller.ts`, `unaccrue-salary-accrual-line.http.controller.ts`,
      `get-salary-accrual.http.controller.ts`, `list-salary-accruals.http.controller.ts`,
      `salary-accrual-lines.e2e.spec.ts`, `salary-accruals.e2e.spec.ts`; в `interface/dto/salary-accrual/`:
      `accrue-salary-accrual-line.dto.ts`, `adjust-salary-accrual-line.dto.ts`, `list-salary-accruals-query.dto.ts`.
- [ ] Обновить импорты (включая `accounting.module.ts`) и прогнать `npm run lint && npm run test && npm run build`.

**Когда готово**: Кластер `salary-accrual` целиком в подпапках `salary-accrual/`; `lint/test/build` без регрессий.

---

## Фаза 5: Кластер `erp-cash` (конфигурация кассы, без переноса конфига из `config/`)

**Цель**: Перенести оставшиеся файлы конфигурации/документов ERP-кассы, не относящиеся к выплатам. Сам перенос
`config/erp-cash.config.ts` и переименование `ErpCashConfigProvider` — отдельно, в Фазе 9 (риск выше: rename
класса, а не только перенос).
**Что затрагивает?** backend

**Задачи:**
- [ ] `git mv` в `application/ports/erp-cash/`: `erp-cash-config.port.ts`, `erp-cash-document.port.ts`,
      `payout-cashbox-record-repository.port.ts`; в `application/services/erp-cash/`:
      `get-erp-cash-config.service.ts`.
- [ ] `git mv` в `interface/http-controllers/erp-cash/`: `get-erp-cash-config.http.controller.ts`.
- [ ] Обновить импорты (включая `accounting.module.ts`) и прогнать `npm run lint && npm run test && npm run build`.

**Когда готово**: Кластер `erp-cash` (кроме конфигурации в Фазе 9) целиком в подпапках `erp-cash/`;
`lint/test/build` без регрессий.

---

## Фаза 6: Кластер `salary-report`

**Цель**: Перенести отчёты по зарплате сотрудника/отдела в единый кластер.
**Что затрагивает?** backend

**Задачи:**
- [ ] `git mv` в `application/services/salary-report/`: `get-employee-salary-report.service.{ts,spec.ts}`,
      `get-department-salary-report.service.{ts,spec.ts}` (`application/mappers/salary-report/` уже на месте —
      не трогать).
- [ ] `git mv` в `interface/http-controllers/salary-report/`: `get-employee-salary-report.http.controller.ts`,
      `get-employee-salary-report.e2e.spec.ts`, `get-department-salary-report.http.controller.ts`.
- [ ] Обновить импорты (включая `accounting.module.ts`) и прогнать `npm run lint && npm run test && npm run build`.

**Когда готово**: Кластер `salary-report` целиком в подпапках `salary-report/`; `lint/test/build` без регрессий.

---

## Фаза 7: Кластер `calculation` (сквозной, переносится последним из основных кластеров)

**Цель**: Перенести сквозную расчётную инфраструктуру, когда все клиенты уже переехали в свои кластеры.
**Что затрагивает?** backend

**Задачи:**
- [ ] `git mv` в `application/ports/calculation/`: `accounting-calculation-cache.port.ts`,
      `service-calculation-data.port.ts`, `snapshot-rows-calculator.port.ts`.
- [ ] `git mv` в `application/services/calculation/`: `build-service-calculation-context.service.ts`,
      `calculate-service-snapshot-rows.service.ts`, `resolve-employee-salary-rules.service.{ts,spec.ts}`.
- [ ] Обновить импорты (включая `accounting.module.ts`) и прогнать `npm run lint && npm run test && npm run build`.
- [ ] Проверить, что `application/{command,services,ports}` и `interface/{http-controllers,dto}` не содержат
      файлов вне подпапок кластеров (кроме случаев, где у слоя нет файлов данного кластера, как `application/
      mappers`, у которого есть только `salary-report/`).

**Когда готово**: Все 7 кластеров `application`/`interface` перенесены; `lint/test/build` без регрессий.

---

## Фаза 8: `application/events` и `domain/entities` — слои, которых нет (или нет полностью) в shop

**Цель**: Разложить `application/events` (слой отсутствует в shop целиком — событий там пока никто не обрабатывает)
по тем же кластерам, что и `application/command`, и догруппировать `domain/entities`, которые в shop уже полностью
разложены, а в service — только частично (`salary-rules/`).
**Что затрагивает?** backend

**Задачи:**
- [ ] `git mv` в `application/events/accounting-period/`: `accounting-period-closed.event-handler.{ts,spec.ts}`;
      в `application/events/motivation-schema/`: `motivation-schema-created.event-handler.{ts,spec.ts}`.
- [ ] `git mv` в `domain/entities/accounting-period/`: `accounting-period.entity.{ts,spec.ts}`; в
      `domain/entities/erp-cash/`: `payout-cashbox-record.entity.ts`.
- [ ] `git mv` в `domain/entities/motivation-schema/`: `motivation-schema.entity.{ts,spec.ts}`; в
      `domain/entities/salary-accrual/`: `salary-accrual.entity.{ts,spec.ts}`, `salary-accrual-line.entity.ts`,
      `salary-accrual-line-adjustment.entity.ts`.
- [ ] Обновить импорты (включая `accounting.module.ts`) и прогнать `npm run lint && npm run test && npm run build`.

**Когда готово**: `application/events` разложен по кластерам `accounting-period/`, `motivation-schema/`;
`domain/entities` полностью сгруппирован (`accounting-period/`, `erp-cash/`, `motivation-schema/`,
`salary-accrual/`, `salary-rules/`); `lint/test/build` без регрессий.

---

## Фаза 9: Нормализация имён и мёртвый код в `domain/`

**Цель**: Устранить домен-спам в именах файлов, опечатки и артефакты компиляции — точечные переименования,
которых не было в реорганизации shop (там переименований не делали вовсе), но которые прямо запрошены для
service.
**Что затрагивает?** backend

**Задачи:**
- [ ] `git mv domain/services/service-role-source.ts domain/services/role-source.ts` (+ `.spec.ts`); обновить
      импорты (класс/функции `resolveServiceRoleSource`, `employeeMatchesServiceRole`, `hasRoappEmployeeIdentity` —
      имена экспортов не трогаем, меняется только путь файла).
- [ ] `git mv domain/services/roapp-order-link.ts domain/services/erp-order-link-builder.ts`; переименовать
      `buildRoappOrderLink` → `buildErpOrderLink`; обновить 2 точки использования
      (`domain/entities/salary-rules/order-payed.entity.ts`, `domain/entities/salary-rules/service-completed.entity.ts`).
- [ ] `git mv domain/types/service-calculation-data.types.ts domain/types/calculation-data.types.ts`; обновить
      импорты (тип `ServiceCalculationErpData` не переименовываем).
- [ ] Удалить `domain/types/salary-rule.types.js` (закоммиченный артефакт компиляции, не используется рантаймом
      — проверить `.gitignore` на предмет `*.js` рядом с `*.ts` в `src/`, добавить правило, если отсутствует).
- [ ] Удалить `domain/exeptions/salary-rule.exeption.ts` и папку `domain/exeptions/` — класс `SalaryRuleExeption`
      нигде не используется (см. PRD «Открытый вопрос 1»); если ревью решит иначе — перенести в
      `domain/exceptions/salary-rule.exception.ts` с исправленным именем класса вместо удаления.

**Когда готово**: В `domain/` не осталось файлов с домен-префиксом-спамом, опечаток в путях/классах или
закоммиченных артефактов сборки; `lint/test/build` без регрессий.

---

## Фаза 10: Конфигурация кассы RemOnline и финальная проверка

**Цель**: Устранить единственную структурную асимметрию, которой нет в shop вообще — отдельные корневые папки
`config/` и `infrastructure/config/` для одного и того же конфига кассы, — и подтвердить, что весь модуль
соответствует критериям готовности PRD.
**Что затрагивает?** backend

**Задачи:**
- [ ] `git mv config/erp-cash.config.ts infrastructure/repositories/erp-cash/erp-cash.config.ts`.
- [ ] `git mv infrastructure/config/erp-cash-config.provider.ts infrastructure/repositories/erp-cash/erp-cash-config.repository.ts`;
      переименовать класс `ErpCashConfigProvider` → `ErpCashConfigRepository` (роль — репозиторий поверх `.env`,
      как и `CashboxConfigRepository` у shop); удалить опустевшие папки `config/` и `infrastructure/config/`.
- [ ] Обновить DI-регистрацию в `accounting.module.ts` (класс и путь импорта) и все остальные ссылки
      (`grep -rn "ErpCashConfigProvider\|accounting/config/erp-cash.config\|accounting/infrastructure/config" backend/src`).
- [ ] Прогнать `npm run lint && npm run test && npm run build` — без регрессий.
- [ ] Финальная проверка по критериям готовности PRD: ни один файл не задублирован в двух кластерах, все
      `.spec.ts` рядом с исходником, `git log --follow` находит историю каждого перенесённого файла,
      `ENDPOINTS.md` не требует изменений.

**Когда готово**: Модуль `domains/service/modules/accounting` структурно соответствует эталону
`domains/shop/modules/accounting` по всем пунктам сравнения из PRD; `lint/test/build` зелёные; критерии
готовности PRD выполнены полностью.
