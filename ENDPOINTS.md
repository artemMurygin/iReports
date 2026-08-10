# Эндпоинты backend (backend/src)

Все пути указаны от корня, глобальный префикс не задан.

## domains/service/modules/accounting (`/accounting`, `/v1/motivation-schema`)
- `GET /accounting/salary_report/employee/:id/:period` — отчёт по зарплате сотрудника за период (`period` — `YYYY-MM`): итог и разбивка по правилам мотивационной схемы, пара «факт/прогноз»
- `POST /v1/motivation-schema` — создать мотивационную схему (цель + набор зарплатных правил)

## modules/employee-identity (`/v1/employee-identity`)
Идентификация сотрудника между Bitrix24 / RemOnline / МойСклад (Фаза 2). Все эндпоинты закрыты
`PortalAdminGuard` — доступны только администратору портала Bitrix24 (заголовок `x-bitrix-auth` с
access token текущего пользователя из `BX24.getAuth()`); без токена или не-администратору — `403`.
- `POST /v1/employee-identity` — создать связь «сотрудник Bitrix × внешняя система × внешний идентификатор»
- `PATCH /v1/employee-identity/:id` — изменить тип идентификатора и/или внешний ID связи
- `DELETE /v1/employee-identity/:id` — удалить связь
- `GET /v1/employee-identity/employee/:employeeId` — связи конкретного сотрудника
- `GET /v1/employee-identity/unmatched` — сотрудники Bitrix без единой связи ни в одной системе

## deals (`/deals`)
- `GET /deals?from&to` — список сделок за период
- `GET /deals/stages` — этапы
- `GET /deals/models` — модели устройств
- `GET /deals/managers` — менеджеры
- `GET /deals/sources` — источники
- `GET /deals/stage-groups` — группы этапов

## integrations/bitrix (`/bitrix`)
- `POST /bitrix/install` — вебхук установки приложения Bitrix24 (возвращает HTML)

## integrations/roapp (`/roapp`)
- `GET /roapp/service-categories`

## integrations/custom-api-roapp (`/custom-api-roapp`)
- `POST /custom-api-roapp/create-service`
- `GET /custom-api-roapp/service-bonus/:id`

## priceMonitoring (`/price-monitoring`)
- `POST /price-monitoring/update-shop-products-costs`
- `POST /price-monitoring/update-service-price`
- `GET /price-monitoring/:uuid/status`
- `GET /price-monitoring/:uuid` — SSE (прогресс задачи + heartbeat)

## reports (`/reports`)
- `GET /reports/service-funnel`
- `GET /reports/service-categories`
- `GET /reports/services-analytics`

## salary/adjustments (`/salary-adjustments`)
- `POST /salary-adjustments`
- `GET /salary-adjustments?employeeId&period`

## salary/categories (`/salary/categories`)
- `GET /salary/categories?direction`

## salary/directory (`/salary`)
- `GET /salary/employees`
- `GET /salary/departments`
- `PATCH /salary/employees/:id`

## salary/goals (`/goals`)
- `POST /goals`
- `PATCH /goals/:id`
- `DELETE /goals/:id` (204)

## salary/plan-fact (без префикса)
- `GET /plan-fact?filter`
- `POST /plan-targets`
- `PATCH /plan-targets/:id`
- `DELETE /plan-targets/:id` (204)

## salary/report (`/salaryReport`)
- `GET /salaryReport?employeeId&period`
- `POST /salaryReport/close`

## salary/rewards (`/rewards`)
- `POST /rewards`
- `PATCH /rewards/:id`

## salary/rules (`/salary-rules`)
- `GET /salary-rules?filter`
- `POST /salary-rules`
- `PATCH /salary-rules/:id`
- `POST /salary-rules/:id/archive`
- `DELETE /salary-rules/:id` (204)

## salary/task-completions (`/task-completions`)
- `POST /task-completions`
- `PATCH /task-completions/:id`

## salary/turnover (`/turnover`)
- `GET /turnover?period` — заглушка, всегда отвечает 501 "NO_DATA" (нет интеграции с МойСклад)

## salary/work-schedule (без префикса)
- `GET /work-schedule?employeeId&period`
- `POST /work-schedule/bulk`
- `PATCH /work-shifts/:id`