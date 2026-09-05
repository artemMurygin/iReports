## Purpose

Определяет поведение серверного сессионного слоя iReports поверх Redis: создание, доставку
клиенту, продление, инвалидацию сессий и защиту cookie-варианта от CSRF — независимо от способа,
которым пользователь прошёл аутентификацию.

## ADDED Requirements

### Requirement: Создание серверной сессии в Redis при успешном входе
После успешной аутентификации (любым сценарием) backend SHALL создавать запись сессии в Redis вида
`session_id -> {userId, memberId, permissions}`.

#### Scenario: Сессия создаётся после успешного входа
- **WHEN** пользователь успешно проходит аутентификацию (embedded или OAuth)
- **THEN** в Redis появляется запись session_id с данными userId, memberId и текущими permissions
  пользователя

### Requirement: session_id — криптографически случайный и одноразовый на логин
`session_id` SHALL быть криптографически случайной строкой не менее 32 байт энтропии и SHALL
генерироваться заново при каждом логине, включая повторный логин того же пользователя.

#### Scenario: Повторный логин выдаёт новый session_id
- **WHEN** пользователь, уже имевший активную сессию, логинится повторно
- **THEN** backend выпускает новый session_id, отличный от предыдущего (защита от session
  fixation)

### Requirement: Доставка session_id через cookie для standalone-сайта и iOS
Для standalone-сайта и iOS-приложения backend SHALL передавать `session_id` клиенту в виде cookie
с атрибутами HttpOnly, Secure и SameSite=None.

#### Scenario: Standalone-вход устанавливает защищённую cookie
- **WHEN** пользователь входит как standalone-сайт или из iOS-приложения
- **THEN** backend устанавливает cookie с session_id, помеченную HttpOnly, Secure и SameSite=None

### Requirement: Доставка session_id через Authorization-заголовок для iframe-контекста
Для контекста iframe портала Bitrix24, где cookie ненадёжны из-за SameSite/ITP-ограничений
браузеров, backend SHALL принимать `session_id` через заголовок `Authorization: Bearer
<session_id>`, а frontend SHALL хранить его только в памяти, не в localStorage/sessionStorage.

#### Scenario: Запросы из iframe используют заголовок Authorization
- **WHEN** пользователь работает внутри iframe портала и выполняет запросы к backend
- **THEN** session_id передаётся в заголовке `Authorization: Bearer <session_id>`, а не через
  cookie

### Requirement: Sliding expiration TTL сессии
TTL сессии SHALL продлеваться при каждой активности пользователя (sliding expiration), а не быть
фиксированным с момента создания; значение TTL SHALL быть конфигурируемым.

#### Scenario: Активность продлевает жизнь сессии
- **WHEN** пользователь с активной сессией выполняет запрос к backend до истечения TTL
- **THEN** TTL сессии в Redis продлевается от момента этого запроса

### Requirement: Отклонение запросов без валидной сессии
Backend SHALL отклонять запросы к защищённым ресурсам, если предъявленный session_id отсутствует,
не найден в Redis или истёк.

#### Scenario: Запрос без активной сессии получает 401
- **WHEN** пользователь без активной сессии обращается к защищённому роуту
- **THEN** backend возвращает 401, и обработчик роута не выполняется

### Requirement: Logout удаляет сессию на сервере
Logout SHALL удалять соответствующую запись сессии из Redis, а не только очищать cookie/состояние
на клиенте.

#### Scenario: Использование session_id после logout отклоняется
- **WHEN** пользователь выходит из системы, а затем клиент повторно предъявляет прежний session_id
- **THEN** backend возвращает 401, так как сессия удалена из Redis

### Requirement: Принудительная инвалидация всех сессий пользователя
Backend SHALL поддерживать обратный индекс `user_sessions:<userId> -> set(session_id)` в Redis и
SHALL уметь по нему инвалидировать (удалять) все активные сессии конкретного пользователя одной
операцией.

#### Scenario: Массовая инвалидация закрывает доступ по всем сессиям
- **WHEN** для пользователя с несколькими активными сессиями (например, на разных устройствах)
  выполняется принудительная инвалидация
- **THEN** все его session_id удаляются из Redis, и последующие запросы с любым из них получают 401

### Requirement: CSRF-защита cookie-варианта сессии
Так как `SameSite=None` допускает cross-site отправку cookie, backend SHALL требовать
дополнительную CSRF-защиту (double-submit cookie или synchronizer token) для изменяющих состояние
запросов, аутентифицированных cookie-сессией.

#### Scenario: Запрос с валидной cookie, но без CSRF-токена отклоняется
- **WHEN** изменяющий состояние запрос (например, POST/PATCH/DELETE) приходит с валидной
  cookie-сессией, но без корректного CSRF-токена
- **THEN** backend отклоняет запрос, несмотря на валидность самой сессии
