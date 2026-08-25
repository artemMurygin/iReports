# Plan: Отметка «дежурный» на вкладке «Календарь» графика работы (backend)

**PRD**: формального PRD-файла нет — задача поставлена напрямую в чате и уточнена вопросами перед составлением плана. Краткое ТЗ:

> На вкладке «Календарь» страницы «График работы» нужно уметь отмечать день сотрудника как «дежурный». На фронтенде это будет зелёная обводка ячейки; отметка о дежурстве должна отдаваться backend'ом в данных по ячейке сотрудника за день.

Уточнения, полученные перед планированием:
- В один день дежурными могут быть несколько сотрудников одновременно (независимый флаг на каждой записи графика, без взаимного исключения).
- Отметка ставится/снимается через тот же `PUT`-эндпоинт редактирования дня графика (`/v1/work-schedule/entries`), что и статус/часы/роль — отдельного эндпоинта не заводим.
- Дежурство можно проставить только в рабочий день (`status = WORKING`) — тот же инвариант, что уже действует для `hours`/`role` в `WorkDay.create()`.

**Дата**: 2026-08-24

**Скоуп этого плана**: только backend (явный запрос — «Пропиши реализацию для бэкэнда»). Отрисовка зелёной обводки и любые фронтенд-правки — отдельная задача, в план не входят и не планируются здесь.

**Вне скоупа** (сознательно не покрывается этим планом, т.к. не упомянуто в постановке):
- Вкладка «Роли» и мобильный экран «Отдел сегодня» (`GET /v1/work-schedule/shift`, `workScheduleShiftEmployeeSchema`) — постановка ограничена вкладкой «Календарь».
- Агрегаты «сколько дежурных в этот день» по аналогии с `peopleOnShiftByDay` — просили только флаг по ячейке сотрудник×день, не агрегат.
- Любое влияние дежурства на расчёт зарплаты.

## Затронутые файлы (справочно, по слоям)

- `backend/prisma/schema/work-schedule.prisma` — модель `WorkScheduleEntry`
- `contracts/commands/work-schedule.ts` — `workScheduleEntrySchema`, `upsertWorkScheduleEntryRequestSchema`, `workScheduleDayCellSchema`
- `backend/src/modules/work-schedule/domain/value-objects/work-day.value-object.ts` — `WorkDay`
- `backend/src/modules/work-schedule/application/command/upsert-work-schedule-entry.command.ts` + `.handler.ts`
- `backend/src/modules/work-schedule/application/mappers/to-work-schedule-entry-response.ts`
- `backend/src/modules/work-schedule/infrastructure/mappers/work-schedule-entry.mapper.ts`
- `backend/src/modules/work-schedule/application/services/get-monthly-work-schedule.service.ts` — `buildEmployeeRow`

## Фазы реализации

### Фаза 1: Хранение и запись отметки «дежурный» (Tracer Bullet)

**Цель**: день сотрудника можно пометить/снять как дежурный через существующий `PUT /v1/work-schedule/entries`; значение валидируется и сохраняется в БД.

**Что затрагивает?** backend, database

**Задачи:**
- [ ] Prisma-миграция: новая колонка `is_on_duty BOOLEAN NOT NULL DEFAULT false` в модели `WorkScheduleEntry` (`prisma/schema/work-schedule.prisma`), `npx prisma migrate dev --config prisma.config.ts --name add_work_schedule_is_on_duty`
- [ ] Контракт (`contracts/commands/work-schedule.ts`): поле `isOnDuty: z.boolean()` в `workScheduleEntrySchema` (ответ) и `isOnDuty: z.boolean().optional().default(false)` в `upsertWorkScheduleEntryRequestSchema` (запрос — опционально для обратной совместимости со старыми клиентами); пересобрать пакет `ireports-contracts` (`npm run build` в `contracts/`)
- [ ] Domain (`work-day.value-object.ts`): новое поле `isOnDuty: boolean` в `WorkDayProps`/`CreateWorkDayProps` (опционально на входе, по умолчанию `false`), инвариант в `WorkDay.create()` — `isOnDuty: true` допустимо только при `status === 'WORKING'` (иначе `ArgumentInvalidException`, тем же приёмом, что и у `hours`/`role`), геттер `isOnDuty`
- [ ] Application (`upsert-work-schedule-entry.command.ts`/`.handler.ts`, `to-work-schedule-entry-response.ts`): поле `isOnDuty` прокидывается из команды в `WorkDay.create(...)` и возвращается в `WorkScheduleEntryResponse`
- [ ] Infrastructure (`work-schedule-entry.mapper.ts`): `toDomain`/`toPersistence` читают/пишут `isOnDuty` из/в Prisma-запись

**Когда готово**: `PUT /v1/work-schedule/entries` с `{ status: 'WORKING', ..., isOnDuty: true }` сохраняет запись и возвращает `isOnDuty: true` в ответе; тот же запрос с `status`, отличным от `WORKING`, и `isOnDuty: true` возвращает 400; повторный upsert той же записи с `isOnDuty: false` снимает отметку.

**Тесты:**
- `work-day.value-object.spec.ts` — `isOnDuty: true` + `WORKING` создаётся успешно; `isOnDuty: true` + не-`WORKING` бросает `ArgumentInvalidException`; `isOnDuty` не передан → `false` по умолчанию
- `upsert-work-schedule-entry.handler.spec.ts` — создание новой записи с `isOnDuty: true`; обновление существующей записи (`isOnDuty: true` → `false` и обратно)
- `work-schedule-entry.mapper.spec.ts` — round-trip `toDomain`/`toPersistence` сохраняет `isOnDuty`
- `work-schedule.e2e.spec.ts` — `PUT /v1/work-schedule/entries` с `isOnDuty` в теле: happy path и 400 на нерабочий день

### Фаза 2: Отметка в данных ячейки вкладки «Календарь» (чтение)

**Цель**: `GET /v1/work-schedule` (месячный график) отдаёт `isOnDuty` по каждой ячейке сотрудник×день — данные, из которых фронтенд сможет отрисовать зелёную обводку.

**Что затрагивает?** backend

**Задачи:**
- [ ] Контракт (`contracts/commands/work-schedule.ts`): поле `isOnDuty: z.boolean()` в `workScheduleDayCellSchema`
- [ ] `GetMonthlyWorkScheduleService.buildEmployeeRow`: заполненная ячейка (есть запись графика) возвращает `isOnDuty: entry.day.isOnDuty`; пустая ячейка (записи нет за этот день) — `isOnDuty: false`

**Когда готово**: `GET /v1/work-schedule?month=YYYY-MM` возвращает в каждой ячейке `days` поле `isOnDuty`, значение которого соответствует тому, что было сохранено через `PUT` в Фазе 1 для этого сотрудника и дня.

**Тесты:**
- `get-monthly-work-schedule.service.spec.ts` — сотрудник с `isOnDuty: true` в конкретный день: ячейка этого дня возвращает `isOnDuty: true`, остальные дни того же сотрудника и все дни других сотрудников — `isOnDuty: false`
- `work-schedule.e2e.spec.ts` — расширить существующий e2e-сценарий `GET /v1/work-schedule`: после `PUT` с `isOnDuty: true` соответствующая ячейка в ответе `GET` содержит `isOnDuty: true`
