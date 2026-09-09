## Purpose

Определяет поведение получения и поддержания токенов доступа Bitrix24 для пользователя iReports в
двух сценариях входа (embedded/iframe и OAuth 2.0), а также правила сведения обоих сценариев к
единой внутренней модели пользователя и автоматического обновления токенов.

## Requirements

### Requirement: Аутентификация через embedded/iframe-сценарий
Когда приложение запущено внутри iframe портала Bitrix24, backend SHALL принимать данные сессии
BX24 (DOMAIN, AUTH_ID, AUTH_EXPIRES, REFRESH_ID, member_id, APP_SID), переданные фронтендом после
`BX24.init()`, и SHALL создавать пользовательскую сессию только после успешной валидации этих
данных.

#### Scenario: Успешный вход из iframe портала
- **WHEN** фронтенд внутри iframe портала Bitrix24 выполняет `BX24.init()` и передаёт полученные
  AUTH_ID/member_id на backend
- **THEN** backend создаёт сессию только после того, как отдельным REST-запросом к Bitrix24
  (например `user.current`) подтвердит, что AUTH_ID действителен для указанного портала

### Requirement: Обязательная валидация embedded-токена запросом к Bitrix24 REST
Backend SHALL считать переданные из iframe POST-данные (AUTH_ID, member_id и т.д.) недоверенными,
пока они не подтверждены реальным запросом к Bitrix24 REST API — создание сессии на основании
одних лишь переданных данных без такого запроса запрещено.

#### Scenario: Поддельный или невалидный AUTH_ID отклоняется
- **WHEN** backend получает из iframe AUTH_ID, который не проходит проверку REST-запросом к
  Bitrix24 (портал отвечает ошибкой авторизации)
- **THEN** backend отказывает в создании сессии и не выдаёт пользователю доступ

### Requirement: Аутентификация через OAuth 2.0 authorization code flow
Для запуска как standalone-сайта или как iOS-приложения backend SHALL поддерживать полный
OAuth 2.0 authorization code flow: редирект пользователя на `{portal}/oauth/authorize/` и обмен
полученного `code` на `access_token`/`refresh_token` через `oauth.bitrix24.tech/oauth/token/`
(`grant_type=authorization_code`) серверным (server-to-server) запросом.

#### Scenario: Успешный вход через standalone-сайт
- **WHEN** пользователь на standalone-сайте проходит OAuth-редирект и подтверждает доступ
  приложению
- **THEN** backend обменивает полученный `code` на `access_token`/`refresh_token` серверным
  запросом и создаёт сессию пользователя

#### Scenario: Обмен кода на токены выполняется без задержек
- **WHEN** backend получает `code` авторизации от Bitrix24
- **THEN** обмен `code` на токены выполняется немедленно, до истечения его срока жизни (30 секунд)

### Requirement: Защита OAuth-флоу от login-CSRF через сверку `state`
Перед редиректом на `{portal}/oauth/authorize/` frontend SHALL генерировать случайный `state` и
сохранять его в рамках текущей вкладки (переживает сам редирект на Bitrix24 и обратно, не должен
переживать закрытие вкладки/браузера дольше, чем нужно для одного цикла входа). При приёме
callback frontend SHALL сверять `state` из URL с сохранённым значением ДО отправки `code` на
backend и SHALL немедленно удалять сохранённое значение после однократной сверки (использование
допустимо только один раз).

#### Scenario: Callback с несовпадающим state отклоняется до отправки кода на backend
- **WHEN** frontend получает OAuth-callback, в котором `state` из URL не совпадает с ранее
  сохранённым значением (или сохранённое значение отсутствует)
- **THEN** frontend не отправляет `code` на backend и показывает пользователю сообщение об ошибке
  входа

#### Scenario: Совпавший state используется только один раз
- **WHEN** frontend успешно сверил `state` и отправил `code` на backend
- **THEN** сохранённое значение `state` удаляется сразу после сверки, повторное использование того
  же callback-URL повторно не проходит проверку

### Requirement: Приём OAuth-редиректа на frontend
Frontend SHALL предоставлять маршрут, принимающий редирект от Bitrix24 с параметрами `code` и
`state` в query-строке, выполняющий сверку `state` (см. отдельное требование) и, при успехе,
передающий `code` на backend-эндпоинт обмена кода на токены.

#### Scenario: Успешный callback приводит к созданию сессии
- **WHEN** пользователь возвращается на frontend по `redirect_uri` с валидными `code` и `state`
- **THEN** frontend отправляет `code` на backend, backend обменивает его на токены и создаёт
  сессию (см. "Успешный вход через standalone-сайт")

### Requirement: Изоляция client_secret приложения на backend
`client_secret` приложения Bitrix24 SHALL храниться и использоваться только на backend и SHALL
никогда не передаваться клиенту (frontend, мобильному приложению) ни в каком виде — ни в теле или
заголовках ответов API, ни в конфигурации, отдаваемой клиенту.

#### Scenario: Ответы клиенту не содержат client_secret
- **WHEN** frontend или iOS-приложение получает любой ответ backend, связанный с аутентификацией
- **THEN** тело и заголовки ответа не содержат `client_secret` приложения

### Requirement: OAuth-аутентификация в iOS-приложении
iOS-приложение SHALL использовать тот же протокол OAuth 2.0 authorization code flow через
`ASWebAuthenticationSession`, с `redirect_uri` в виде universal link или кастомной URL-схемы,
обрабатываемым тем же backend-эндпоинтом обмена кода на токены, что и standalone-сценарий.

#### Scenario: Вход из iOS-приложения
- **WHEN** пользователь в iOS-приложении завершает OAuth-поток через `ASWebAuthenticationSession`
- **THEN** приложение получает `redirect_uri` (universal link/кастомная URL-схема) с `code`,
  который backend обменивает на токены тем же способом, что и для standalone-сайта

### Requirement: Единая внутренняя модель пользователя независимо от сценария входа
Независимо от того, каким из двух сценариев (embedded или OAuth) пользователь получил доступ,
backend SHALL приводить результат к единой внутренней модели `User <-> member_id <->
(access_token, refresh_token, expires_at)`, так чтобы последующая логика (сессии, RBAC) не
зависела от исходного сценария входа.

#### Scenario: Один и тот же member_id даёт одного и того же пользователя независимо от сценария
- **WHEN** один и тот же пользователь Bitrix24 (member_id) входит один раз через embedded-сценарий,
  а в другой раз через OAuth
- **THEN** backend сопоставляет оба входа одному и тому же внутреннему пользователю iReports

### Requirement: Автоматическое обновление access_token
Backend SHALL хранить `access_token`/`refresh_token`, привязанные к `member_id`, и SHALL
автоматически обновлять `access_token` через `refresh_token` до истечения срока его действия,
прежде чем выполнять от имени пользователя запрос к Bitrix24 REST.

#### Scenario: Истёкший access_token обновляется перед запросом
- **WHEN** backend делает запрос к Bitrix24 REST API от имени пользователя, чей `access_token`
  истёк
- **THEN** backend сначала обновляет `access_token` через `refresh_token`, а затем повторяет
  исходный запрос уже с новым токеном
